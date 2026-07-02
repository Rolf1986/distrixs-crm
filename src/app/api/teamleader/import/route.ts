import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  refreshTokens,
  fetchCompanies,
  fetchContacts,
  fetchDeals,
  fetchQuotations,
  fetchInvoices,
  fetchProducts,
} from "@/lib/teamleader";
import {
  nextDealNumber,
  nextInvoiceNumber,
  nextQuoteNumber,
} from "@/lib/sequences";
import type { DealStatus, InvoiceStatus, QuoteStatus } from "@/generated/prisma";

export const maxDuration = 300;

// ─── Token helpers ────────────────────────────────────────────────────────────

async function getValidAccessToken(): Promise<string> {
  const row = await prisma.$queryRaw<
    Array<{
      teamleader_access_token: string | null;
      teamleader_refresh_token: string | null;
      teamleader_token_expires_at: Date | null;
    }>
  >`
    SELECT teamleader_access_token, teamleader_refresh_token, teamleader_token_expires_at
    FROM company_settings WHERE id = 'singleton'
  `;

  if (!row.length || !row[0].teamleader_access_token) {
    throw new Error("Teamleader niet gekoppeld. Koppel eerst via de importpagina.");
  }

  const { teamleader_access_token, teamleader_refresh_token, teamleader_token_expires_at } =
    row[0];

  const soon = new Date(Date.now() + 5 * 60 * 1000);
  if (
    teamleader_token_expires_at &&
    teamleader_token_expires_at < soon &&
    teamleader_refresh_token
  ) {
    const tokens = await refreshTokens(teamleader_refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.$executeRaw`
      UPDATE company_settings SET
        teamleader_access_token     = ${tokens.access_token},
        teamleader_refresh_token    = ${tokens.refresh_token},
        teamleader_token_expires_at = ${expiresAt},
        updated_at                  = NOW()
      WHERE id = 'singleton'
    `;
    return tokens.access_token;
  }

  return teamleader_access_token;
}

// ─── Status mappers ───────────────────────────────────────────────────────────

function mapDealStatus(status: string): DealStatus {
  switch (status) {
    case "won":  return "WON";
    case "lost": return "LOST";
    default:     return "NEW";
  }
}

function mapQuoteStatus(status: string): QuoteStatus {
  switch (status) {
    case "sent":     return "SENT";
    case "accepted": return "ACCEPTED";
    case "rejected": return "REJECTED";
    default:         return "DRAFT";
  }
}

function mapInvoiceStatus(status: string): InvoiceStatus {
  switch (status) {
    case "outstanding":        return "SENT";
    case "paid":
    case "matched":            return "PAID";
    case "overdue":            return "OVERDUE";
    default:                   return "DRAFT";
  }
}

// ─── Customer number helper ───────────────────────────────────────────────────

function makeCustomerNumber(year: number, seq: number): string {
  return `K-${year}-${String(seq).padStart(3, "0")}`;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(): Promise<Response> {
  const counts = { products: 0, customers: 0, contacts: 0, deals: 0, quotes: 0, invoices: 0 };

  try {
    const accessToken = await getValidAccessToken();
    const year = new Date().getFullYear();

    // ── System user ──────────────────────────────────────────────────────────
    const systemUser = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!systemUser) {
      return NextResponse.json(
        { error: "Geen gebruikers gevonden. Maak eerst een gebruiker aan." },
        { status: 400 }
      );
    }
    const systemUserId = systemUser.id;

    // ── Pre-load existing records into Maps ──────────────────────────────────
    // These bulk selects replace thousands of individual findUnique calls.

    const [
      existingProducts,
      existingCustomers,
      existingContacts,
      existingDeals,
      existingQuotes,
      existingInvoices,
    ] = await Promise.all([
      prisma.product.findMany({ where: { externalId: { startsWith: "tl-product-" } }, select: { externalId: true } }),
      prisma.customer.findMany({ where: { externalId: { startsWith: "tl-company-" } }, select: { id: true, externalId: true, customerNumber: true } }),
      prisma.customerContact.findMany({ where: { externalId: { startsWith: "tl-contact-" } }, select: { id: true, externalId: true } }),
      prisma.deal.findMany({ where: { externalId: { startsWith: "tl-deal-" } }, select: { id: true, externalId: true } }),
      prisma.quote.findMany({ where: { externalId: { startsWith: "tl-quotation-" } }, select: { id: true, externalId: true } }),
      prisma.invoice.findMany({ where: { externalId: { startsWith: "tl-invoice-" } }, select: { externalId: true } }),
    ]);

    // externalId → local id / boolean
    const existingProductIds  = new Set(existingProducts.map(r => r.externalId!));
    const existingInvoiceIds  = new Set(existingInvoices.map(r => r.externalId!));

    // tlCompanyId → customerId  (populated as we import)
    const companyIdToCustomerId = new Map<string, string>();
    for (const c of existingCustomers) {
      // externalId format: "tl-company-<tlId>"
      const tlId = c.externalId!.replace("tl-company-", "");
      companyIdToCustomerId.set(tlId, c.id);
    }

    // tlContactId → local customerContact id
    const contactIdToLocalId = new Map<string, string>();
    for (const ct of existingContacts) {
      const tlId = ct.externalId!.replace("tl-contact-", "");
      contactIdToLocalId.set(tlId, ct.id);
    }

    // tlDealId → local deal id
    const dealIdToLocalId = new Map<string, string>();
    for (const d of existingDeals) {
      const tlId = d.externalId!.replace("tl-deal-", "");
      dealIdToLocalId.set(tlId, d.id);
    }

    // tlQuotationId → local quote id
    const quotationIdToLocalId = new Map<string, string>();
    for (const q of existingQuotes) {
      const tlId = q.externalId!.replace("tl-quotation-", "");
      quotationIdToLocalId.set(tlId, q.id);
    }

    // Customer number counter — numeriek max bepalen in JS (string-sort werkt niet voor >999)
    const prefix = `K-${year}-`;
    const allNums = await prisma.customer.findMany({
      where: { customerNumber: { startsWith: prefix } },
      select: { customerNumber: true },
    });
    let customerSeq = allNums.reduce((max, r) => {
      const n = parseInt(r.customerNumber.replace(prefix, ""), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);

    // SKU lookup set to avoid duplicate sku conflicts
    const existingSkus = new Set(
      (await prisma.product.findMany({ select: { sku: true } })).map(p => p.sku)
    );

    // ── 1. Products ──────────────────────────────────────────────────────────
    let importSupplier = await prisma.supplier.findFirst({
      where: { name: "Teamleader Import" },
      select: { id: true },
    });
    if (!importSupplier) {
      importSupplier = await prisma.supplier.create({
        data: { name: "Teamleader Import", supplierType: "OTHER" },
      });
    }

    const tlProducts = await fetchProducts(accessToken);
    for (const p of tlProducts) {
      const externalId = `tl-product-${p.id}`;
      if (existingProductIds.has(externalId)) continue;

      let sku = p.code ?? `TL-${p.id.slice(0, 8)}`;
      if (existingSkus.has(sku)) {
        sku = `${sku}-${p.id.slice(0, 4)}`;
      }
      existingSkus.add(sku);

      await prisma.product.create({
        data: {
          sku,
          title: p.name,
          shortDescription: p.description ?? null,
          supplierId: importSupplier.id,
          advisorySellPrice: p.selling_price?.amount ?? p.price?.amount ?? 0,
          baseCostPrice: p.purchase_price?.amount ?? 0,
          unit: p.unit ?? "stuk",
          externalId,
        },
      });
      counts.products++;
    }

    // ── 2. Companies → Customers ─────────────────────────────────────────────
    const tlCompanies = await fetchCompanies(accessToken);

    for (const c of tlCompanies) {
      const externalId = `tl-company-${c.id}`;
      if (companyIdToCustomerId.has(c.id)) continue; // already mapped from pre-load

      customerSeq++;
      const customerNumber = makeCustomerNumber(year, customerSeq);

      const customer = await prisma.customer.create({
        data: {
          customerNumber,
          companyName: c.name,
          vatNumber: c.vat_number ?? null,
          status: "ACTIVE",
          externalId,
        },
      });
      companyIdToCustomerId.set(c.id, customer.id);
      counts.customers++;
    }

    // ── 3. Contacts → CustomerContacts ───────────────────────────────────────
    const tlContacts = await fetchContacts(accessToken);

    for (const ct of tlContacts) {
      const externalId = `tl-contact-${ct.id}`;
      if (contactIdToLocalId.has(ct.id)) continue; // already mapped from pre-load

      const linkedCompany = ct.companies?.[0]?.company;
      const customerId = linkedCompany
        ? companyIdToCustomerId.get(linkedCompany.id)
        : undefined;
      if (!customerId) continue; // no known customer — skip

      const email = ct.emails?.[0]?.email ?? null;
      const phone = ct.telephones?.[0]?.number ?? null;
      const roleOrFunction = ct.companies?.[0]?.function ?? null;

      const contact = await prisma.customerContact.create({
        data: {
          customerId,
          firstName: ct.first_name,
          lastName: ct.last_name,
          email,
          phone,
          roleOrFunction,
          externalId,
        },
      });
      contactIdToLocalId.set(ct.id, contact.id);
      counts.contacts++;
    }

    // ── 4. Deals ─────────────────────────────────────────────────────────────
    const tlDeals = await fetchDeals(accessToken);
    let dealsSkippedExisting = 0, dealsSkippedNoCustomer = 0;
    let dealsSkipTypeCompany = 0, dealsSkipTypeContact = 0, dealsSkipTypeNone = 0;
    console.log(`[import] Teamleader deals opgehaald: ${tlDeals.length}, in DB: ${dealIdToLocalId.size}`);
    // Log eerste deal volledig om structuur te zien
    if (tlDeals[0]) console.log(`[import] deal[0] volledig:`, JSON.stringify(tlDeals[0]));

    for (const d of tlDeals) {
      const externalId = `tl-deal-${d.id}`;
      if (dealIdToLocalId.has(d.id)) { dealsSkippedExisting++; continue; }

      // Resolve customer: nieuwe TL-deals gebruiken lead.customer, oude deals customer
      const customerRef = d.lead?.customer ?? d.customer;
      let customerId: string | undefined;
      if (customerRef?.type === "company") {
        customerId = companyIdToCustomerId.get(customerRef.id);
      } else if (customerRef?.type === "contact") {
        const localContactId = contactIdToLocalId.get(customerRef.id);
        if (localContactId) {
          const contact = await prisma.customerContact.findUnique({
            where: { id: localContactId },
            select: { customerId: true },
          });
          customerId = contact?.customerId ?? undefined;
        }
      }
      if (!customerId) {
        dealsSkippedNoCustomer++;
        if (!customerRef) dealsSkipTypeNone++;
        else if (customerRef.type === "company") dealsSkipTypeCompany++;
        else dealsSkipTypeContact++;
        continue;
      }

      const dealNumber = await nextDealNumber(year);
      const deal = await prisma.deal.create({
        data: {
          dealNumber,
          title: d.title,
          customerId,
          status: mapDealStatus(d.status),
          expectedCloseDate: d.estimated_closing_date
            ? new Date(d.estimated_closing_date)
            : null,
          createdBy: systemUserId,
          externalId,
        },
      });
      dealIdToLocalId.set(d.id, deal.id);
      counts.deals++;
    }
    console.log(`[import] Deals: ${counts.deals} nieuw, ${dealsSkippedExisting} al aanwezig, ${dealsSkippedNoCustomer} geen klant (company=${dealsSkipTypeCompany}, contact=${dealsSkipTypeContact}, geen=${dealsSkipTypeNone})`);

    // ── 5. Quotations → Quotes ───────────────────────────────────────────────
    const tlQuotations = await fetchQuotations(accessToken);
    let quotesSkippedExisting = 0, quotesSkippedNoCustomer = 0;
    console.log(`[import] Teamleader offertes opgehaald: ${tlQuotations.length}, in DB: ${quotationIdToLocalId.size}`);

    for (const q of tlQuotations) {
      const externalId = `tl-quotation-${q.id}`;
      if (quotationIdToLocalId.has(q.id)) { quotesSkippedExisting++; continue; }

      // Resolve customer: nieuwe TL-offertes gebruiken lead.customer, oude offertes customer
      const qCustomerRef = q.lead?.customer ?? q.customer;
      let customerId: string | undefined;
      if (qCustomerRef?.type === "company") {
        customerId = companyIdToCustomerId.get(qCustomerRef.id);
      } else if (qCustomerRef?.type === "contact") {
        const localContactId = contactIdToLocalId.get(qCustomerRef.id);
        if (localContactId) {
          const contact = await prisma.customerContact.findUnique({
            where: { id: localContactId },
            select: { customerId: true },
          });
          customerId = contact?.customerId ?? undefined;
        }
      }
      if (!customerId) { quotesSkippedNoCustomer++; continue; }

      const dealId = q.deal?.id ? (dealIdToLocalId.get(q.deal.id) ?? null) : null;
      const total    = q.total?.tax_inclusive?.amount ?? 0;
      const subtotal = q.total?.tax_exclusive?.amount ?? 0;
      const vatAmount = Math.max(total - subtotal, 0);

      const quoteNumber = await nextQuoteNumber(year);
      const quote = await prisma.quote.create({
        data: {
          quoteNumber,
          dealId,
          customerId,
          status: mapQuoteStatus(q.status),
          subtotal,
          vatAmount,
          total,
          createdBy: systemUserId,
          externalId,
        },
      });
      quotationIdToLocalId.set(q.id, quote.id);
      counts.quotes++;
    }
    console.log(`[import] Offertes: ${counts.quotes} nieuw, ${quotesSkippedExisting} al aanwezig, ${quotesSkippedNoCustomer} geen klant gevonden`);

    // ── 6. Invoices ──────────────────────────────────────────────────────────
    const tlInvoices = await fetchInvoices(accessToken);

    for (const inv of tlInvoices) {
      const externalId = `tl-invoice-${inv.id}`;
      if (existingInvoiceIds.has(externalId)) continue;

      // Resolve customer: invoicee first, then direct customer, then contact fallback
      const customerRef = inv.invoicee?.customer ?? inv.customer;
      let customerId: string | undefined;
      if (customerRef?.type === "company") {
        customerId = companyIdToCustomerId.get(customerRef.id);
      } else if (customerRef?.type === "contact") {
        const localContactId = contactIdToLocalId.get(customerRef.id);
        if (localContactId) {
          const contact = await prisma.customerContact.findUnique({
            where: { id: localContactId },
            select: { customerId: true },
          });
          customerId = contact?.customerId ?? undefined;
        }
      }
      if (!customerId) continue;

      const dealId   = inv.deal?.id ? (dealIdToLocalId.get(inv.deal.id) ?? null) : null;
      const total    = inv.total?.tax_inclusive?.amount ?? 0;
      const subtotal = inv.total?.tax_exclusive?.amount ?? 0;
      const vatAmount = Math.max(total - subtotal, 0);
      const invoiceDate = inv.invoice_date ? new Date(inv.invoice_date) : new Date();
      const dueDate     = inv.due_on ? new Date(inv.due_on) : new Date(Date.now() + 30 * 86_400_000);
      const status      = mapInvoiceStatus(inv.status);
      const paidAmount  = status === "PAID" ? total : 0;
      // Store original TL invoice number as reference
      const ourReference = inv.invoice_number?.number
        ? `TL-${inv.invoice_number.number}`
        : null;

      const invoiceNumber = await nextInvoiceNumber(year);
      await prisma.invoice.create({
        data: {
          invoiceNumber,
          dealId,
          customerId,
          status,
          invoiceDate,
          dueDate,
          subtotal,
          vatAmount,
          total,
          paidAmount,
          openAmount: total - paidAmount,
          createdBy: systemUserId,
          externalId,
          ...(ourReference ? { ourReference } : {}),
        },
      });
      counts.invoices++;
    }

    return NextResponse.json({ imported: counts });
  } catch (err) {
    console.error("Teamleader import error:", err);
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
