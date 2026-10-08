import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { nextDealNumber } from "@/lib/sequences";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { buildDealLineData } from "@/lib/dealLines";
import {
  INTAKE_MAX_BODY_BYTES,
  verifyIntakeSignature,
  parseQuoteRequest,
  addWorkdays,
  type QuoteRequest,
} from "@/lib/websiteIntake";

// ─── Offerte-aanvraag vanaf distrixs.nl → nieuwe deal ──────────────────────────
// Alleen server-to-server: de WordPress-site ondertekent met WEBSITE_INTAKE_SECRET
// (zie src/lib/websiteIntake.ts). Geen sessie, geen CORS — browsers horen hier niet te komen.

type MatchedBy = "webshop-account" | "contact-email" | "customer-email" | "company-name" | "new-prospect";

const MATCH_LABEL: Record<MatchedBy, string> = {
  "webshop-account": "gekoppeld webshop-account",
  "contact-email": "e-mailadres van een contactpersoon",
  "customer-email": "e-mailadres van de klant",
  "company-name": "bedrijfsnaam (controleren!)",
  "new-prospect": "nieuwe prospect aangemaakt",
};

export async function POST(req: NextRequest) {
  const limit = rateLimit(`intake:${clientIp(req)}`, 60, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Te veel aanvragen" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  const secret = process.env.WEBSITE_INTAKE_SECRET ?? "";
  if (secret.length < 32) {
    console.error("[intake] WEBSITE_INTAKE_SECRET ontbreekt of is te kort");
    return NextResponse.json({ error: "Niet geconfigureerd" }, { status: 503 });
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > INTAKE_MAX_BODY_BYTES) return NextResponse.json({ error: "Te groot" }, { status: 413 });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > INTAKE_MAX_BODY_BYTES) return NextResponse.json({ error: "Te groot" }, { status: 413 });

  if (!verifyIntakeSignature(raw, req.headers.get("x-dx-timestamp"), req.headers.get("x-dx-signature"), secret)) {
    return NextResponse.json({ error: "Ongeldige handtekening" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }
  const parsed = parseQuoteRequest(json);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });
  const data = parsed.data;

  // Idempotent: dezelfde aanvraag twee keer → dezelfde deal terug.
  const externalId = `web-raq-${data.requestId}`;
  const existing = await prisma.deal.findUnique({ where: { externalId }, select: { id: true, dealNumber: true } });
  if (existing) return NextResponse.json({ ok: true, duplicate: true, dealId: existing.id, dealNumber: existing.dealNumber });

  const systemUser = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!systemUser) return NextResponse.json({ error: "Geen beheerder in CRM" }, { status: 503 });

  try {
    const { customerId, contactId, matchedBy } = await resolveCustomer(data);

    const productPerItem = await resolveProducts(data.items);

    const year = new Date().getFullYear();
    const dealNumber = await nextDealNumber(year);

    const deal = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          dealNumber,
          title: `Offerteaanvraag website – ${data.contact.company}`.slice(0, 200),
          customerId,
          primaryContactId: contactId,
          status: "NEW",
          notes: buildNotes(data, matchedBy, productPerItem),
          externalId,
          createdBy: systemUser.id,
        },
      });

      for (const [i, item] of data.items.entries()) {
        const product = productPerItem[i];
        if (!product) continue;
        const line = buildDealLineData(product, item.qty);
        // Algemeen CRM-product (bv. "Catalogus gobo grijsschaal"): het specifieke website-artikel in de regel noemen.
        if (item.crmSku && item.crmSku !== item.sku) line.titleSnapshot = `${product.title} – ${item.name}`.slice(0, 250);
        await tx.dealLine.create({ data: { dealId: deal.id, productId: product.id, ...line } });
      }

      await tx.activity.create({
        data: {
          dealId: deal.id,
          customerId,
          contactId,
          type: "TASK",
          title: "Offerteaanvraag website opvolgen",
          notes: "Klant heeft via de website een offerte aangevraagd; de site belooft antwoord binnen 2 werkdagen.",
          dueAt: addWorkdays(new Date(), 2),
          createdBy: systemUser.id,
        },
      });
      return deal;
    });

    await logAudit({
      action: "WEBSITE_QUOTE_REQUEST",
      entityType: "Deal",
      entityId: deal.id,
      newValue: { requestId: data.requestId, matchedBy, items: data.items.length },
    });

    return NextResponse.json({ ok: true, dealId: deal.id, dealNumber: deal.dealNumber, matchedBy }, { status: 201 });
  } catch (e) {
    // Gelijktijdige herhaling van dezelfde aanvraag: unieke externalId → bestaande deal teruggeven.
    const again = await prisma.deal.findUnique({ where: { externalId }, select: { id: true, dealNumber: true } });
    if (again) return NextResponse.json({ ok: true, duplicate: true, dealId: again.id, dealNumber: again.dealNumber });
    console.error("[intake] aanmaken deal mislukt", e);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}

const productInclude = { supplier: { select: { id: true, supplierType: true } }, priceTiers: true } as const;
type ProductMetLijn = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Zelfde normalisatie als bij het vergelijken van artikelnummers: alleen letters/cijfers, kleine letters. */
const normSku = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * CRM-product per aangevraagde regel: eerst het door de website opgegeven CRM-artikelnummer
 * (koppeling of gobo-regel), anders het website-artikelnummer; exact, en anders zonder
 * spaties/streepjes/hoofdletters.
 */
async function resolveProducts(items: QuoteRequest["items"]): Promise<(ProductMetLijn | undefined)[]> {
  const sleutels = items.map((i) => i.crmSku ?? i.sku);
  const exact = await prisma.product.findMany({
    where: { sku: { in: [...new Set(sleutels.filter((s): s is string => !!s))] }, isActive: true },
    include: productInclude,
  });
  const bySku = new Map(exact.map((p) => [p.sku, p]));

  const missend = sleutels.filter((s): s is string => !!s && !bySku.has(s));
  let byNorm = new Map<string, ProductMetLijn>();
  if (missend.length) {
    const alle = await prisma.product.findMany({ where: { isActive: true }, select: { id: true, sku: true } });
    const gezocht = new Set(missend.map(normSku));
    const ids = alle.filter((p) => gezocht.has(normSku(p.sku))).map((p) => p.id);
    if (ids.length) {
      const gevonden = await prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude });
      byNorm = new Map(gevonden.map((p) => [normSku(p.sku), p]));
    }
  }
  return sleutels.map((s) => (s ? bySku.get(s) ?? byNorm.get(normSku(s)) : undefined));
}

/** Zoek de klant bij deze aanvraag; maak zo nodig een contactpersoon of prospect aan. */
async function resolveCustomer(data: QuoteRequest): Promise<{ customerId: string; contactId: string; matchedBy: MatchedBy }> {
  const c = data.contact;

  // 1. Ingelogd op de webshop en dat account is in het CRM al aan een klant gekoppeld.
  if (data.wcUserId) {
    const acc = await prisma.webshopAccount.findUnique({
      where: { wcUserId: data.wcUserId },
      select: { customerId: true, contactId: true },
    });
    if (acc?.customerId) {
      const contactId = acc.contactId ?? (await findOrCreateContact(acc.customerId, c));
      return { customerId: acc.customerId, contactId, matchedBy: "webshop-account" };
    }
  }

  // 2. Bekende contactpersoon (e-mail).
  const contact = await prisma.customerContact.findFirst({
    where: { email: { equals: c.email, mode: "insensitive" }, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true, customerId: true },
  });
  if (contact) return { customerId: contact.customerId, contactId: contact.id, matchedBy: "contact-email" };

  // 3. Bekend algemeen e-mailadres van een klant.
  const byEmail = await prisma.customer.findFirst({
    where: { email: { equals: c.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (byEmail) {
    return { customerId: byEmail.id, contactId: await findOrCreateContact(byEmail.id, c), matchedBy: "customer-email" };
  }

  // 4. Exact dezelfde bedrijfsnaam — alleen als dat er precies één is.
  const byName = await prisma.customer.findMany({
    where: { companyName: { equals: c.company, mode: "insensitive" } },
    select: { id: true },
    take: 2,
  });
  if (byName.length === 1) {
    return { customerId: byName[0].id, contactId: await findOrCreateContact(byName[0].id, c), matchedBy: "company-name" };
  }

  // 5. Nieuw: prospect met contactpersoon.
  const customer = await createProspect(c);
  return { customerId: customer.id, contactId: customer.contactId, matchedBy: "new-prospect" };
}

async function findOrCreateContact(customerId: string, c: QuoteRequest["contact"]): Promise<string> {
  const found = await prisma.customerContact.findFirst({
    where: { customerId, email: { equals: c.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (found) return found.id;
  const created = await prisma.customerContact.create({
    data: { customerId, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, isActive: true },
    select: { id: true },
  });
  return created.id;
}

/** Klantnummer K-YYYY-NNNN = numeriek hoogste + 1, met retry bij een gelijktijdig bezet nummer. */
async function createProspect(c: QuoteRequest["contact"]): Promise<{ id: string; contactId: string }> {
  const prefix = `K-${new Date().getFullYear()}-`;
  const existing = await prisma.customer.findMany({
    where: { customerNumber: { startsWith: prefix } },
    select: { customerNumber: true },
  });
  let maxSeq = 0;
  for (const row of existing) {
    const n = parseInt(row.customerNumber.slice(prefix.length), 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const customer = await prisma.customer.create({
        data: {
          customerNumber: `${prefix}${String(maxSeq + 1 + attempt).padStart(4, "0")}`,
          companyName: c.company,
          email: c.email,
          status: "PROSPECT",
          notes: "Aangemaakt vanuit een offerteaanvraag op distrixs.nl.",
          contacts: {
            create: {
              firstName: c.firstName,
              lastName: c.lastName,
              email: c.email,
              phone: c.phone,
              isPrimary: true,
              isActive: true,
            },
          },
        },
        select: { id: true, contacts: { select: { id: true } } },
      });
      return { id: customer.id, contactId: customer.contacts[0].id };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new Error("Geen vrij klantnummer gevonden");
}

function buildNotes(data: QuoteRequest, matchedBy: MatchedBy, productPerItem: (unknown | undefined)[]): string {
  const c = data.contact;
  const lines = [
    "Offerteaanvraag via distrixs.nl",
    `Klant gevonden via: ${MATCH_LABEL[matchedBy]}`,
    `Aanvrager: ${c.firstName} ${c.lastName} · ${c.company} · ${c.email} · ${c.phone}`,
  ];
  if (data.message) lines.push("", "Bericht van de klant:", data.message);

  lines.push("", "Aangevraagde producten:");
  for (const [i, item] of data.items.entries()) {
    const inCrm = !!productPerItem[i];
    lines.push(
      `- ${item.qty}× ${item.name}${item.sku ? ` (SKU ${item.sku})` : ""}${inCrm ? "" : " — niet in CRM gevonden, geen dealregel"}`
    );
    for (const o of item.options) lines.push(`    · ${o.label}: ${o.value}`);
    if (item.productUrl) lines.push(`    ${item.productUrl}`);
  }
  lines.push("", `Aanvraag-ID: ${data.requestId}`);
  return lines.join("\n");
}
