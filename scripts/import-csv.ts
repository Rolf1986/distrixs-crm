/**
 * Teamleader Focus → Distrixs CRM — CSV Import
 * ═════════════════════════════════════════════
 *
 * VOORBEREIDING — Exporteer vanuit Teamleader Focus:
 * ───────────────────────────────────────────────────
 *   1. Bedrijven  → Bedrijven → Exporteer  → sla op als: import/bedrijven.csv
 *   2. Contacten  → Contacten → Exporteer  → sla op als: import/contacten.csv
 *   3. Deals      → Deals     → Exporteer  → sla op als: import/deals.csv
 *   4. Facturen   → Facturen  → Exporteer  → sla op als: import/facturen.csv
 *   5. Producten  → Producten → Exporteer  → sla op als: import/producten.csv
 *
 *   Zorg dat je bij export kiest voor:
 *   - Formaat: CSV
 *   - Scheidingsteken: Puntkomma (;)
 *   - Alle beschikbare kolommen aangevinkt
 *
 * UITVOEREN:
 * ──────────
 *   mkdir -p import
 *   # Zet de geëxporteerde CSV-bestanden in de import/ map
 *   npx tsx scripts/import-csv.ts
 *
 * IDEMPOTENT: al bestaande records worden overgeslagen op basis van naam/nummer.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

// ─── CSV parser ────────────────────────────────────────────────────────────────

function parseCsv(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, ""); // strip BOM
  const firstLine = raw.split("\n")[0] ?? "";
  const sep = firstLine.includes(";") ? ";" : ",";

  const lines = raw.split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0], sep);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line, sep);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === sep && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/** Zoek een waarde op in een rij via meerdere kolomnamen */
function col(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    for (const k of [key, key.toLowerCase(), key.toUpperCase()]) {
      if (row[k] !== undefined && row[k] !== "") return row[k].trim();
    }
  }
  return "";
}

function num(val: string): number {
  return parseFloat(val.replace(",", ".").replace(/[^0-9.\-]/g, "")) || 0;
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const parts = val.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Bootstrap data ────────────────────────────────────────────────────────────

let importUserId = "";
let importSupplierId = "";
let customerNumberCounter = 0;

async function bootstrap() {
  // Zoek of maak een import-gebruiker
  let user = await prisma.user.findFirst({ where: { email: "import@distrixs.nl" }, select: { id: true } });
  if (!user) {
    user = await prisma.user.create({
      data: { name: "Import", email: "import@distrixs.nl", role: "ADMIN", passwordHash: "" },
    });
    console.log("   👤  Import-gebruiker aangemaakt (import@distrixs.nl)");
  }
  importUserId = user.id;

  // Zoek of maak een import-leverancier voor producten zonder leverancier
  let supplier = await prisma.supplier.findFirst({ where: { name: "Import" }, select: { id: true } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: { name: "Import", supplierType: "EU", isActive: true },
    });
  }
  importSupplierId = supplier.id;

  // Klantnummer teller
  const last = await prisma.customer.findFirst({ orderBy: { customerNumber: "desc" }, select: { customerNumber: true } });
  customerNumberCounter = last
    ? (parseInt(last.customerNumber.replace(/\D/g, "")) || 999) + 1
    : 1000;
}

function nextNum(): string {
  return String(customerNumberCounter++).padStart(4, "0");
}

// ─── Import: Bedrijven → Customers ────────────────────────────────────────────

async function importBedrijven(file: string) {
  console.log("\n📂  Bedrijven importeren…");
  const rows = parseCsv(file);
  console.log(`   ${rows.length} rijen gevonden`);

  let created = 0, skipped = 0;

  for (const row of rows) {
    const name = col(row,
      "Naam", "Name", "Bedrijfsnaam", "Company name", "Bedrijf",
      "naam", "name", "bedrijfsnaam", "company"
    );
    if (!name) { skipped++; continue; }

    const existing = await prisma.customer.findFirst({
      where: { companyName: { equals: name, mode: "insensitive" } },
    });
    if (existing) { skipped++; continue; }

    const vatRaw = col(row,
      "BTW-nummer", "VAT number", "btw nummer", "BTW nummer", "Btw",
      "vat", "BTW", "VAT", "btwnummer", "btw_nummer"
    );
    const vatCountry = vatRaw ? vatRaw.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "NL" : null;
    const vatNumber  = vatRaw ? vatRaw.replace(/\s/g, "").toUpperCase() : null;

    const customer = await prisma.customer.create({
      data: {
        customerNumber: nextNum(),
        companyName: name,
        vatNumber,
        vatCountry,
        kvkNumber: col(row, "KvK", "KVK", "kvk", "Chamber of commerce", "CoC", "kvknummer") || null,
        status: "ACTIVE",
      },
    });

    // Adres aanmaken
    const street  = col(row, "Straat", "Street", "Adres", "Address", "straat", "street");
    const city    = col(row, "Stad", "City", "Woonplaats", "Plaats", "stad", "city", "plaats");
    const postal  = col(row, "Postcode", "Postal code", "Zip", "postcode", "postal_code");
    const country = col(row, "Land", "Country", "land", "country") || "NL";

    if (street || city || postal) {
      await prisma.customerAddress.create({
        data: {
          customerId: customer.id,
          type: "BILLING",
          street: street || "-",
          houseNumber: col(row, "Huisnummer", "House number", "Nr", "huisnummer") || "",
          postalCode: postal || "",
          city: city || "",
          country,
          isDefault: true,
        },
      });
    }

    created++;
  }

  console.log(`   ✅  ${created} aangemaakt, ${skipped} overgeslagen`);
}

// ─── Import: Contacten → CustomerContacts ─────────────────────────────────────

async function importContacten(file: string) {
  console.log("\n📂  Contacten importeren…");
  const rows = parseCsv(file);
  console.log(`   ${rows.length} rijen gevonden`);

  let created = 0, skipped = 0, noCompany = 0;

  for (const row of rows) {
    const firstName   = col(row, "Voornaam", "First name", "firstname", "voornaam");
    const lastName    = col(row, "Achternaam", "Last name", "lastname", "achternaam", "Naam", "name");
    const email       = col(row, "E-mail", "Email", "email", "e-mail", "E-mailadres");
    const companyName = col(row,
      "Bedrijf", "Company", "Bedrijfsnaam", "Company name",
      "bedrijf", "company", "Gekoppeld bedrijf"
    );

    if (!firstName && !lastName) { skipped++; continue; }

    let customerId: string | null = null;

    if (companyName) {
      const c = await prisma.customer.findFirst({
        where: { companyName: { equals: companyName, mode: "insensitive" } },
        select: { id: true },
      });
      customerId = c?.id ?? null;
    }

    if (!customerId && email) {
      const domain = email.split("@")[1];
      if (domain && !["gmail.com","outlook.com","hotmail.com","yahoo.com"].includes(domain)) {
        const c = await prisma.customer.findFirst({
          where: { contacts: { some: { email: { contains: `@${domain}`, mode: "insensitive" } } } },
          select: { id: true },
        });
        customerId = c?.id ?? null;
      }
    }

    if (!customerId) {
      if (companyName) {
        const newCustomer = await prisma.customer.create({
          data: { customerNumber: nextNum(), companyName, status: "ACTIVE" },
        });
        customerId = newCustomer.id;
      } else {
        noCompany++;
        skipped++;
        continue;
      }
    }

    if (email) {
      const dup = await prisma.customerContact.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, customerId },
      });
      if (dup) { skipped++; continue; }
    }

    await prisma.customerContact.create({
      data: {
        customerId,
        firstName: firstName || lastName,
        lastName:  lastName || "",
        email:     email || null,
        phone:     col(row, "Telefoon", "Phone", "telefoon", "phone", "Tel", "Mobiel", "Mobile") || null,
        roleOrFunction: col(row, "Functie", "Function", "Role", "functie", "Job title", "Titel") || null,
        isPrimary: false,
        isActive: true,
      },
    });
    created++;
  }

  console.log(`   ✅  ${created} aangemaakt, ${skipped} overgeslagen${noCompany > 0 ? `, ${noCompany} zonder bedrijf` : ""}`);
}

// ─── Import: Producten ─────────────────────────────────────────────────────────

async function importProducten(file: string) {
  console.log("\n📂  Producten importeren…");
  const rows = parseCsv(file);
  console.log(`   ${rows.length} rijen gevonden`);

  let created = 0, skipped = 0, skuCounter = 1;

  // Hoogste SKU bepalen
  const lastSku = await prisma.product.findFirst({ orderBy: { sku: "desc" }, select: { sku: true } });
  if (lastSku) {
    const n = parseInt(lastSku.sku.replace(/\D/g, ""));
    if (!isNaN(n)) skuCounter = n + 1;
  }

  for (const row of rows) {
    const title = col(row,
      "Naam", "Name", "Productnaam", "Product name", "naam", "name",
      "Omschrijving", "Description", "Titel", "Title"
    );
    if (!title) { skipped++; continue; }

    const existing = await prisma.product.findFirst({
      where: { title: { equals: title, mode: "insensitive" } },
    });
    if (existing) { skipped++; continue; }

    const priceStr = col(row,
      "Verkoopprijs", "Selling price", "Prijs", "Price", "prijs", "price",
      "Eenheidsprijs", "Unit price", "Verkoopprijs excl. BTW"
    );
    const costStr  = col(row,
      "Inkoopprijs", "Purchase price", "Kostprijs", "Cost price", "kostprijs"
    );

    const skuRaw = col(row, "SKU", "Artikelnummer", "Code", "sku", "artikelnummer", "Productnummer");
    const sku = skuRaw || `IMP-${String(skuCounter++).padStart(5, "0")}`;

    // Check sku uniek
    const dupSku = await prisma.product.findFirst({ where: { sku } });
    const finalSku = dupSku ? `IMP-${String(skuCounter++).padStart(5, "0")}` : sku;

    await prisma.product.create({
      data: {
        title,
        sku: finalSku,
        shortDescription: col(row, "Beschrijving", "Description", "beschrijving") || null,
        supplierId: importSupplierId,
        advisorySellPrice: num(priceStr),
        baseCostPrice: num(costStr) || 0,
        unit: col(row, "Eenheid", "Unit", "eenheid", "unit") || "stuk",
        isActive: true,
      },
    });
    created++;
  }

  console.log(`   ✅  ${created} aangemaakt, ${skipped} overgeslagen`);
}

// ─── Import: Deals ─────────────────────────────────────────────────────────────

async function importDeals(file: string) {
  console.log("\n📂  Deals importeren…");
  const rows = parseCsv(file);
  console.log(`   ${rows.length} rijen gevonden`);

  let created = 0, skipped = 0;

  const lastDeal = await prisma.deal.findFirst({ orderBy: { dealNumber: "desc" }, select: { dealNumber: true } });
  let dealCounter = lastDeal
    ? (parseInt(lastDeal.dealNumber.replace(/\D/g, "")) || 0) + 1
    : 1;
  const year = new Date().getFullYear();

  for (const row of rows) {
    const title = col(row,
      "Titel", "Title", "Naam", "Name", "Onderwerp", "Subject",
      "titel", "title", "naam", "Deal"
    );
    const companyName = col(row,
      "Bedrijf", "Company", "Klant", "Customer", "bedrijf", "company", "klant"
    );

    if (!title) { skipped++; continue; }

    let customerId: string | null = null;
    if (companyName) {
      const c = await prisma.customer.findFirst({
        where: { companyName: { equals: companyName, mode: "insensitive" } },
        select: { id: true },
      });
      customerId = c?.id ?? null;
    }
    if (!customerId) { skipped++; continue; }

    const existing = await prisma.deal.findFirst({
      where: { title: { equals: title, mode: "insensitive" }, customerId },
    });
    if (existing) { skipped++; continue; }

    const statusRaw = col(row, "Status", "status", "Fase", "Phase").toLowerCase();
    type DS = "NEW" | "CONTACTED" | "MEETING_PLANNED" | "QUOTE_SENT" | "WON" | "LOST";
    let status: DS = "NEW";
    if (statusRaw.includes("gewon") || statusRaw.includes("won") || statusRaw.includes("akkoord")) status = "WON";
    else if (statusRaw.includes("verloren") || statusRaw.includes("lost") || statusRaw.includes("afgewezen")) status = "LOST";
    else if (statusRaw.includes("offerte") || statusRaw.includes("quote") || statusRaw.includes("proposal")) status = "QUOTE_SENT";
    else if (statusRaw.includes("meeting") || statusRaw.includes("afspraak")) status = "MEETING_PLANNED";
    else if (statusRaw.includes("contact") || statusRaw.includes("gekwalif")) status = "CONTACTED";

    const closeDateStr = col(row,
      "Verwachte sluitdatum", "Expected close date", "Sluitdatum", "Close date", "Afsluitdatum"
    );

    await prisma.deal.create({
      data: {
        dealNumber: `D-${year}-${String(dealCounter++).padStart(3, "0")}`,
        title,
        customerId,
        status,
        expectedCloseDate: parseDate(closeDateStr),
        notes: col(row, "Notities", "Notes", "Beschrijving", "Description", "notities") || null,
        createdBy: importUserId,
      },
    });
    created++;
  }

  console.log(`   ✅  ${created} aangemaakt, ${skipped} overgeslagen`);
}

// ─── Import: Facturen ─────────────────────────────────────────────────────────

async function importFacturen(file: string) {
  console.log("\n📂  Facturen importeren…");
  const rows = parseCsv(file);
  console.log(`   ${rows.length} rijen gevonden`);

  let created = 0, skipped = 0;

  for (const row of rows) {
    const invoiceNr = col(row,
      "Factuurnummer", "Invoice number", "Nummer", "Number",
      "factuurnummer", "invoice_number", "Factuur nr", "Factuurnr"
    );
    const companyName = col(row,
      "Bedrijf", "Company", "Klant", "Customer", "Naam", "bedrijf", "company", "klant"
    );

    if (!invoiceNr) { skipped++; continue; }

    const existing = await prisma.invoice.findFirst({ where: { invoiceNumber: invoiceNr } });
    if (existing) { skipped++; continue; }

    let customerId: string | null = null;
    if (companyName) {
      const c = await prisma.customer.findFirst({
        where: { companyName: { equals: companyName, mode: "insensitive" } },
        select: { id: true },
      });
      customerId = c?.id ?? null;
    }
    if (!customerId) { skipped++; continue; }

    // Zoek of maak deal voor deze klant
    let dealId: string | null = null;
    const deal = await prisma.deal.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (deal) {
      dealId = deal.id;
    } else {
      // Maak een import-deal aan
      const year = new Date().getFullYear();
      const lastD = await prisma.deal.findFirst({ orderBy: { dealNumber: "desc" }, select: { dealNumber: true } });
      const c = lastD ? (parseInt(lastD.dealNumber.replace(/\D/g, "")) || 0) + 1 : 1;
      const newDeal = await prisma.deal.create({
        data: {
          dealNumber: `D-${year}-${String(c).padStart(3, "0")}`,
          title: `Import facturen ${companyName}`,
          customerId,
          status: "WON",
          createdBy: importUserId,
        },
      });
      dealId = newDeal.id;
    }

    const totalStr    = col(row,
      "Totaal incl. BTW", "Total incl. VAT", "Totaal", "Total", "Bedrag",
      "Amount", "totaal", "total", "Bedrag incl", "Inclusief BTW"
    );
    const subtotalStr = col(row,
      "Totaal excl. BTW", "Total excl. VAT", "Subtotaal", "Subtotal",
      "Bedrag excl", "Exclusief BTW", "subtotaal"
    );
    const vatStr = col(row, "BTW bedrag", "VAT amount", "BTW", "Tax", "btw_bedrag");

    const total    = num(totalStr);
    const subtotal = num(subtotalStr) || (total / 1.21);
    const vat      = num(vatStr) || (total - subtotal);

    const statusRaw = col(row, "Status", "status", "Betaalstatus", "Payment status").toLowerCase();
    type IS = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CREDITED";
    let status: IS = "SENT";
    if (statusRaw.includes("betaald") || statusRaw.includes("paid")) status = "PAID";
    else if (statusRaw.includes("te laat") || statusRaw.includes("overdue") || statusRaw.includes("vervallen")) status = "OVERDUE";
    else if (statusRaw.includes("gecredit") || statusRaw.includes("credit") || statusRaw.includes("geannul")) status = "CREDITED";
    else if (statusRaw.includes("concept") || statusRaw.includes("draft")) status = "DRAFT";
    else if (statusRaw.includes("deels") || statusRaw.includes("partial")) status = "PARTIALLY_PAID";

    const invoiceDateStr = col(row,
      "Factuurdatum", "Invoice date", "Datum", "Date", "factuurdatum", "datum"
    );
    const dueDateStr = col(row,
      "Vervaldatum", "Due date", "Betaaldatum", "Payment date", "vervaldatum"
    );

    const invoiceDate = parseDate(invoiceDateStr) ?? new Date();
    const dueDate = parseDate(dueDateStr) ?? new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNr,
        dealId,
        customerId,
        status,
        subtotal,
        vatAmount: vat,
        total,
        paidAmount: status === "PAID" ? total : 0,
        openAmount: status === "PAID" ? 0 : total,
        invoiceDate,
        dueDate,
        ourReference: col(row, "Notities", "Notes", "Beschrijving", "Opmerkingen", "Referentie") || null,
        createdBy: importUserId,
      },
    });
    created++;
  }

  console.log(`   ✅  ${created} aangemaakt, ${skipped} overgeslagen`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const IMPORT_DIR = path.join(process.cwd(), "import");

const FILES: Record<string, { fn: (f: string) => Promise<void>; aliases: string[] }> = {
  bedrijven: { fn: importBedrijven, aliases: ["bedrijven", "companies", "klanten", "customers", "company"] },
  contacten: { fn: importContacten, aliases: ["contacten", "contacts", "personen", "contact"] },
  producten: { fn: importProducten, aliases: ["producten", "products", "artikelen", "product"] },
  deals:     { fn: importDeals,     aliases: ["deals", "opportunities", "kansen", "deal"] },
  facturen:  { fn: importFacturen,  aliases: ["facturen", "invoices", "rekeningen", "invoice", "factuur"] },
};

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Distrixs CRM — Teamleader CSV Import          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (!process.env.DATABASE_URL) {
    console.error("❌  DATABASE_URL niet ingesteld in .env");
    process.exit(1);
  }

  if (!fs.existsSync(IMPORT_DIR)) {
    fs.mkdirSync(IMPORT_DIR, { recursive: true });
    console.log(`📁  Map 'import/' aangemaakt.`);
    console.log(`   Exporteer je data vanuit Teamleader Focus en zet de CSV-bestanden in deze map:`);
    console.log(`   · import/bedrijven.csv`);
    console.log(`   · import/contacten.csv`);
    console.log(`   · import/deals.csv`);
    console.log(`   · import/facturen.csv`);
    console.log(`   · import/producten.csv\n`);
    process.exit(0);
  }

  const csvFiles = fs.readdirSync(IMPORT_DIR).filter(f =>
    f.toLowerCase().endsWith(".csv")
  );

  if (csvFiles.length === 0) {
    console.log(`⚠️   Geen CSV-bestanden gevonden in ${IMPORT_DIR}/`);
    console.log(`   Exporteer vanuit Teamleader Focus en sla op in de import/ map.\n`);
    process.exit(0);
  }

  console.log(`📋  Gevonden bestanden:`);
  csvFiles.forEach(f => console.log(`   · ${f}`));
  console.log("");

  await bootstrap();

  const order = ["bedrijven", "contacten", "producten", "deals", "facturen"];

  for (const key of order) {
    const def = FILES[key];
    const match = csvFiles.find(f => {
      const base = path.basename(f, path.extname(f)).toLowerCase();
      return def.aliases.some(alias => base.includes(alias));
    });

    if (match) {
      await def.fn(path.join(IMPORT_DIR, match));
    } else {
      console.log(`\n⏭️   Geen bestand voor '${key}' gevonden — overgeslagen`);
    }
  }

  console.log("\n✅  Import afgerond!\n");

  await prisma.$disconnect();
  await pool.end();
}

main().catch(e => {
  console.error("❌  Fout:", e);
  process.exit(1);
});
