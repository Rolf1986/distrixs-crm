/**
 * Teamleader Focus → Distrixs CRM — Migratiescript
 * ═══════════════════════════════════════════════════
 *
 * VOORBEREIDING — Access token ophalen:
 * ──────────────────────────────────────
 *   1. Ga naar https://marketplace.focus.teamleader.eu/nl/integraties
 *   2. Maak een nieuwe "Custom Integration" aan
 *   3. Stel de redirect URI in op http://localhost:3001/callback
 *   4. Noteer client_id en client_secret
 *   5. Open in browser:
 *      https://focus.teamleader.eu/oauth2/authorize
 *        ?client_id=<CLIENT_ID>
 *        &response_type=code
 *        &redirect_uri=http://localhost:3001/callback
 *   6. Kopieer de "code" uit de redirect URL
 *   7. Wissel in voor access token via POST:
 *      curl -X POST https://app.focus.teamleader.eu/oauth2/access_token \
 *        -d "client_id=<ID>&client_secret=<SECRET>&code=<CODE>&grant_type=authorization_code&redirect_uri=http://localhost:3001/callback"
 *   8. Zet het access_token in .env.local:
 *      TEAMLEADER_ACCESS_TOKEN=xxxxxx
 *
 * UITVOEREN:
 * ──────────
 *   npx tsx scripts/import-teamleader.ts
 *
 * IDEMPOTENT: al bestaande records (op basis van externalId) worden
 * overgeslagen — je kunt het script veilig meerdere keren draaien.
 *
 * VOLGORDE: Klanten → Contacten → Producten → Deals → Offertes → Facturen
 */

import "dotenv/config";
// Generated Prisma client lives at src/generated/prisma (not @prisma/client default)
import { PrismaClient, Prisma } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// ─── Prisma setup ──────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// ─── Teamleader API helpers ────────────────────────────────────────────────
const TL_BASE = "https://api.focus.teamleader.eu";
const ACCESS_TOKEN = process.env.TEAMLEADER_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("❌  Stel TEAMLEADER_ACCESS_TOKEN in in .env.local");
  process.exit(1);
}

async function tlPost<T>(endpoint: string, body: object = {}): Promise<T> {
  const res = await fetch(`${TL_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TL API ${endpoint} → ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

/** Haalt alle pagina's op voor een list-endpoint */
async function tlList<T>(endpoint: string, extra: object = {}): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  const size = 100;
  while (true) {
    const data = await tlPost<T[]>(endpoint, {
      ...extra,
      page: { size, number: page },
    });
    results.push(...data);
    if (data.length < size) break;
    page++;
    process.stdout.write(".");
  }
  process.stdout.write("\n");
  return results;
}

// ─── Hulpfuncties ──────────────────────────────────────────────────────────
function pick<T>(arr: T[], key: keyof T, val: unknown): T | undefined {
  return arr.find((x) => x[key] === val);
}

function statusToCustomer(s: string): string {
  if (s === "active") return "ACTIVE";
  if (s === "archived") return "INACTIVE";
  return "PROSPECT";
}

function statusToDeal(s: string): string {
  if (s === "won") return "WON";
  if (s === "lost") return "LOST";
  return "NEW";
}

function statusToQuote(s: string): string {
  const map: Record<string, string> = {
    draft: "DRAFT",
    sent: "SENT",
    accepted: "ACCEPTED",
    rejected: "DECLINED",
    expired: "EXPIRED",
  };
  return map[s] ?? "DRAFT";
}

function statusToInvoice(paid: boolean, s: string): string {
  if (paid) return "PAID";
  if (s === "draft") return "DRAFT";
  if (s === "outstanding") return "SENT";
  return "SENT";
}

// ─── Stap 1: Klanten (companies) ──────────────────────────────────────────
async function importCompanies() {
  console.log("\n📦  Klanten importeren…");

  // Zorg voor een systeem-user voor imports
  const systemUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!systemUser) throw new Error("Geen admin-gebruiker gevonden. Maak er eerst een aan.");

  const companies = await tlList<Record<string, unknown>>("companies.list");
  console.log(`   ${companies.length} bedrijven gevonden`);

  let created = 0;
  let skipped = 0;

  for (const c of companies) {
    const tlId = c.id as string;
    const existing = await prisma.customer.findFirst({ where: { externalId: tlId } });
    if (existing) { skipped++; continue; }

    // Bepaal klantnummer op basis van bestaande nummering
    const count = await prisma.customer.count();
    const year = new Date().getFullYear();
    const customerNumber = `K-${year}-${String(count + 1).padStart(3, "0")}`;

    await prisma.customer.create({
      data: {
        customerNumber,
        companyName: (c.name as string) || "Onbekend",
        kvkNumber: (c.national_identification_number as string | null) ?? null,
        vatNumber: (c.vat_number as string | null) ?? null,
        status: statusToCustomer(c.status as string),
        externalId: tlId,
        defaultPaymentTerm: c.payment_term_days
          ? Math.round(c.payment_term_days as number)
          : 30,
      },
    });
    created++;
  }

  console.log(`   ✓ ${created} aangemaakt, ${skipped} overgeslagen`);
  return companies;
}

// ─── Stap 2: Contacten ────────────────────────────────────────────────────
async function importContacts(companies: Record<string, unknown>[]) {
  console.log("\n👥  Contacten importeren…");

  const contacts = await tlList<Record<string, unknown>>("contacts.list", {
    includes: "companies",
  });
  console.log(`   ${contacts.length} contacten gevonden`);

  let created = 0;
  let skipped = 0;

  for (const ct of contacts) {
    const tlId = ct.id as string;
    const existing = await prisma.customerContact.findFirst({ where: { externalId: tlId } });
    if (existing) { skipped++; continue; }

    // Koppel aan klant via company_id
    const companyLinks = (ct.companies as Array<{ id: string; primary: boolean }> | null) ?? [];
    if (companyLinks.length === 0) { skipped++; continue; }

    const primaryLink = companyLinks.find((l) => l.primary) ?? companyLinks[0];
    const tlCompanyId = primaryLink.id;

    const customer = await prisma.customer.findFirst({ where: { externalId: tlCompanyId } });
    if (!customer) { skipped++; continue; }

    // Emails en telefoonnummers
    const emails = (ct.emails as Array<{ type: string; email: string }> | null) ?? [];
    const phones = (ct.telephones as Array<{ type: string; number: string }> | null) ?? [];
    const primaryEmail = emails.find((e) => e.type === "primary")?.email ?? emails[0]?.email ?? null;
    const primaryPhone = phones[0]?.number ?? null;

    await prisma.customerContact.create({
      data: {
        customerId: customer.id,
        firstName: (ct.first_name as string) || "",
        lastName: (ct.last_name as string) || "",
        email: primaryEmail,
        phone: primaryPhone,
        isActive: (ct.status as string) !== "deactivated",
        isPrimary: primaryLink.primary ?? false,
        externalId: tlId,
      },
    });
    created++;
  }

  console.log(`   ✓ ${created} aangemaakt, ${skipped} overgeslagen`);
}

// ─── Stap 3: Deals ────────────────────────────────────────────────────────
async function importDeals() {
  console.log("\n🤝  Deals importeren…");

  const systemUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!systemUser) throw new Error("Geen admin-gebruiker.");

  const deals = await tlList<Record<string, unknown>>("deals.list");
  console.log(`   ${deals.length} deals gevonden`);

  let created = 0;
  let skipped = 0;

  for (const d of deals) {
    const tlId = d.id as string;
    const existing = await prisma.deal.findFirst({ where: { externalId: tlId } });
    if (existing) { skipped++; continue; }

    // Klant ophalen
    const lead = d.lead as { customer: { type: string; id: string } } | null;
    if (!lead?.customer) { skipped++; continue; }

    let customer = await prisma.customer.findFirst({ where: { externalId: lead.customer.id } });
    if (!customer) { skipped++; continue; }

    // Contact ophalen
    const contactPersonId = d.lead_contact_person_id as string | null;
    let contact = null;
    if (contactPersonId) {
      contact = await prisma.customerContact.findFirst({ where: { externalId: contactPersonId } });
    }

    const count = await prisma.deal.count();
    const year = new Date().getFullYear();
    const dealNumber = `D-${year}-${String(count + 1).padStart(3, "0")}`;

    await prisma.deal.create({
      data: {
        dealNumber,
        title: (d.title as string) || "Geïmporteerde deal",
        customerId: customer.id,
        primaryContactId: contact?.id ?? null,
        status: statusToDeal(d.status as string),
        winProbability: d.estimated_probability
          ? Math.round((d.estimated_probability as number) * 100)
          : null,
        expectedCloseDate: d.estimated_closing_date
          ? new Date(d.estimated_closing_date as string)
          : null,
        notes: null,
        createdBy: systemUser.id,
        externalId: tlId,
      },
    });
    created++;
  }

  console.log(`   ✓ ${created} aangemaakt, ${skipped} overgeslagen`);
}

// ─── Stap 4: Offertes ─────────────────────────────────────────────────────
async function importQuotes() {
  console.log("\n📄  Offertes importeren…");

  const systemUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!systemUser) throw new Error("Geen admin-gebruiker.");

  const quotations = await tlList<Record<string, unknown>>("quotations.list");
  console.log(`   ${quotations.length} offertes gevonden`);

  let created = 0;
  let skipped = 0;

  for (const q of quotations) {
    const tlId = q.id as string;
    const existing = await prisma.quote.findFirst({ where: { externalId: tlId } });
    if (existing) { skipped++; continue; }

    // Deal ophalen
    const dealId = q.deal_id as string | null;
    let deal = null;
    let customer = null;

    if (dealId) {
      deal = await prisma.deal.findFirst({ where: { externalId: dealId } });
      if (deal) {
        customer = await prisma.customer.findUnique({ where: { id: deal.customerId } });
      }
    }

    if (!customer) { skipped++; continue; }

    const count = await prisma.quote.count();
    const year = new Date().getFullYear();
    const quoteNumber = `Q-${year}-${String(count + 1).padStart(3, "0")}`;

    const total = (q.total_tax_inclusive_amount as number | null) ?? 0;
    const subtotal = (q.total_tax_exclusive_amount as number | null) ?? 0;

    await prisma.quote.create({
      data: {
        quoteNumber,
        customerId: customer.id,
        dealId: deal?.id ?? null,
        status: statusToQuote(q.status as string),
        quoteDate: q.created_at ? new Date(q.created_at as string) : new Date(),
        validUntil: q.expires_after ? new Date(q.expires_after as string) : null,
        subtotal: new Prisma.Decimal(subtotal),
        vatAmount: new Prisma.Decimal(total - subtotal),
        total: new Prisma.Decimal(total),
        externalId: tlId,
        createdBy: systemUser.id,
      },
    });
    created++;
  }

  console.log(`   ✓ ${created} aangemaakt, ${skipped} overgeslagen`);
}

// ─── Stap 5: Facturen ─────────────────────────────────────────────────────
async function importInvoices() {
  console.log("\n🧾  Facturen importeren…");

  const systemUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!systemUser) throw new Error("Geen admin-gebruiker.");

  const invoices = await tlList<Record<string, unknown>>("invoices.list");
  console.log(`   ${invoices.length} facturen gevonden`);

  let created = 0;
  let skipped = 0;

  for (const inv of invoices) {
    const tlId = inv.id as string;
    const existing = await prisma.invoice.findFirst({ where: { externalId: tlId } });
    if (existing) { skipped++; continue; }

    // Klant ophalen via invoicee_customer_id
    const invoiceeId = inv.invoicee_customer_id as string | null;
    let customer = null;
    if (invoiceeId) {
      customer = await prisma.customer.findFirst({ where: { externalId: invoiceeId } });
    }
    if (!customer) { skipped++; continue; }

    // Deal ophalen
    const tlDealId = inv.deal_id as string | null;
    let deal = null;
    if (tlDealId) {
      deal = await prisma.deal.findFirst({ where: { externalId: tlDealId } });
    }

    const count = await prisma.invoice.count();
    const year = new Date().getFullYear();
    const invoiceNumber = `F-${year}-${String(count + 1).padStart(3, "0")}`;

    const paid = (inv.paid as boolean) ?? false;
    const total = new Prisma.Decimal((inv.total_tax_inclusive_amount as number | null) ?? 0);
    const subtotal = new Prisma.Decimal((inv.total_tax_exclusive_amount as number | null) ?? 0);
    const openAmount = paid ? new Prisma.Decimal(0) : total;
    const status = statusToInvoice(paid, inv.status as string);

    await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: customer.id,
        dealId: deal?.id ?? null,
        status,
        invoiceDate: inv.invoice_date ? new Date(inv.invoice_date as string) : new Date(),
        // dueDate is required in schema — gebruik verre toekomst als fallback
        dueDate: inv.due_on
          ? new Date(inv.due_on as string)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal,
        vatAmount: new Prisma.Decimal(Number(total) - Number(subtotal)),
        total,
        openAmount,
        paidAmount: paid ? total : new Prisma.Decimal(0),
        // Notitie: als de factuur betaald is, zetten we status op PAID
        externalId: tlId,
        createdBy: systemUser.id,
      },
    });
    created++;
  }

  console.log(`   ✓ ${created} aangemaakt, ${skipped} overgeslagen`);
}

// ─── Stap 6: Producten ────────────────────────────────────────────────────
async function importProducts() {
  console.log("\n📦  Producten importeren…");

  const systemUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!systemUser) throw new Error("Geen admin-gebruiker.");

  // Zoek of maak een standaard leverancier aan voor geïmporteerde producten
  let supplier = await prisma.supplier.findFirst();
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: "Onbekend (import)",
        supplierType: "EU",
      },
    });
  }

  const products = await tlList<Record<string, unknown>>("products.list");
  console.log(`   ${products.length} producten gevonden`);

  let created = 0;
  let skipped = 0;

  for (const p of products) {
    const tlId = p.id as string;
    const existing = await prisma.product.findFirst({ where: { externalId: tlId } });
    if (existing) { skipped++; continue; }

    // Prijs ophalen via products.info (gedetailleerder)
    let sellPrice = 0;
    let costPrice = 0;
    try {
      const info = await tlPost<Record<string, unknown>>("products.info", { id: tlId });
      // Teamleader prijzen zitten in selling_prices en purchase_prices arrays
      const sellingPrices = info.selling_prices as Array<{ amount: number }> | null;
      const purchasePrices = info.purchase_prices as Array<{ amount: number }> | null;
      sellPrice = sellingPrices?.[0]?.amount ?? 0;
      costPrice = purchasePrices?.[0]?.amount ?? 0;
    } catch {
      // Als info mislukt, gebruik 0 als prijs
    }

    await prisma.product.create({
      data: {
        sku: (p.code as string) || `TL-${tlId.slice(0, 8)}`,
        title: (p.name as string) || "Onbekend product",
        shortDescription: (p.description as string | null) ?? null,
        unit: "stuk",
        advisorySellPrice: new Prisma.Decimal(sellPrice),
        baseCostPrice: new Prisma.Decimal(costPrice),
        supplierId: supplier.id,
        isActive: true,
        externalId: tlId,
      },
    });
    created++;
  }

  console.log(`   ✓ ${created} aangemaakt, ${skipped} overgeslagen`);
}

// ─── Hoofdprogramma ───────────────────────────────────────────────────────
async function main() {
  console.log("🚀  Teamleader → Distrixs CRM import gestart");
  console.log("   Token:", ACCESS_TOKEN!.slice(0, 8) + "…");

  try {
    const companies = await importCompanies();
    await importContacts(companies);
    await importDeals();
    await importProducts();
    await importQuotes();
    await importInvoices();

    console.log("\n✅  Import voltooid!");
  } catch (err) {
    console.error("\n❌  Fout tijdens import:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
