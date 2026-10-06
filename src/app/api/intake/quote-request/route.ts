import { NextRequest, NextResponse } from "next/server";
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

    const skus = [...new Set(data.items.map((i) => i.sku).filter((s): s is string => !!s))];
    const products = skus.length
      ? await prisma.product.findMany({
          where: { sku: { in: skus }, isActive: true },
          include: { supplier: { select: { id: true, supplierType: true } }, priceTiers: true },
        })
      : [];
    const bySku = new Map(products.map((p) => [p.sku, p]));

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
          notes: buildNotes(data, matchedBy, bySku),
          externalId,
          createdBy: systemUser.id,
        },
      });

      for (const item of data.items) {
        const product = item.sku ? bySku.get(item.sku) : undefined;
        if (!product) continue;
        await tx.dealLine.create({
          data: { dealId: deal.id, productId: product.id, ...buildDealLineData(product, item.qty) },
        });
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

function buildNotes(data: QuoteRequest, matchedBy: MatchedBy, bySku: Map<string, unknown>): string {
  const c = data.contact;
  const lines = [
    "Offerteaanvraag via distrixs.nl",
    `Klant gevonden via: ${MATCH_LABEL[matchedBy]}`,
    `Aanvrager: ${c.firstName} ${c.lastName} · ${c.company} · ${c.email} · ${c.phone}`,
  ];
  if (data.message) lines.push("", "Bericht van de klant:", data.message);

  lines.push("", "Aangevraagde producten:");
  for (const item of data.items) {
    const inCrm = item.sku && bySku.has(item.sku);
    lines.push(
      `- ${item.qty}× ${item.name}${item.sku ? ` (SKU ${item.sku})` : ""}${inCrm ? "" : " — niet in CRM gevonden, geen dealregel"}`
    );
    for (const o of item.options) lines.push(`    · ${o.label}: ${o.value}`);
    if (item.productUrl) lines.push(`    ${item.productUrl}`);
  }
  lines.push("", `Aanvraag-ID: ${data.requestId}`);
  return lines.join("\n");
}
