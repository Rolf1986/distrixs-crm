import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  refreshTokens,
  fetchCompanies,
  fetchContacts,
  fetchDeals,
  fetchQuotations,
  fetchInvoices,
  fetchInvoiceInfo,
  fetchQuotationInfo,
  type TLLineItem,
  fetchProducts,
  fetchCreditNotes,
} from "@/lib/teamleader";
import {
  nextDealNumber,
  nextInvoiceNumber,
  nextQuoteNumber,
  nextCreditNoteNumber,
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

// ─── Regel-mapping (invoices.info / quotations.info) ──────────────────────────

function mapTlLineItem(
  item: TLLineItem,
  productByTlId: Map<string, { id: string; sku: string }>
) {
  const qty = Number(item.quantity ?? 0);
  const unit = Number(item.unit_price?.amount ?? 0);
  const excl = Number(item.total?.tax_exclusive?.amount ?? qty * unit);
  const incl = Number(item.total?.tax_inclusive?.amount ?? excl);
  const vatAmount = Math.round((incl - excl) * 100) / 100;
  let vatRate = excl > 0.001 ? Math.round(((incl / excl) - 1) * 10000) / 100 : 0;
  for (const known of [0, 6, 9, 21]) {
    if (Math.abs(vatRate - known) < 0.5) { vatRate = known; break; }
  }
  const discountPercent =
    item.discount?.type === "percentage" ? Number(item.discount.value ?? 0) : 0;
  const prod = item.product?.id ? productByTlId.get(item.product.id) : undefined;
  return {
    productId: prod?.id ?? null,
    skuSnapshot: prod?.sku ?? "TL",
    titleSnapshot: (item.description ?? "Regel").slice(0, 500),
    qty,
    grossUnitPrice: unit,
    discountPercent,
    netLineTotal: excl,
    vatRate,
    vatAmount,
  };
}

// ─── Customer number helper ───────────────────────────────────────────────────

function makeCustomerNumber(year: number, seq: number): string {
  return `K-${year}-${String(seq).padStart(3, "0")}`;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(): Promise<Response> {
  const counts = { products: 0, customers: 0, contacts: 0, deals: 0, quotes: 0, invoices: 0, invoicesUpdated: 0, creditNotes: 0 };

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
      prisma.product.findMany({ where: { externalId: { startsWith: "tl-product-" } }, select: { id: true, sku: true, externalId: true } }),
      prisma.customer.findMany({ where: { externalId: { startsWith: "tl-company-" } }, select: { id: true, externalId: true, customerNumber: true } }),
      prisma.customerContact.findMany({ where: { externalId: { startsWith: "tl-contact-" } }, select: { id: true, externalId: true } }),
      prisma.deal.findMany({ where: { externalId: { startsWith: "tl-deal-" } }, select: { id: true, externalId: true } }),
      prisma.quote.findMany({ where: { externalId: { startsWith: "tl-quotation-" } }, select: { id: true, externalId: true } }),
      prisma.invoice.findMany({ where: { externalId: { startsWith: "tl-invoice-" } }, select: { id: true, externalId: true, status: true, total: true, dealId: true } }),
    ]);

    // externalId → local id / boolean
    const existingProductIds  = new Set(existingProducts.map(r => r.externalId!));
    // tlProductId → { id, sku } voor factuurregel-koppeling
    const productByTlId = new Map(
      existingProducts.map(r => [r.externalId!.replace("tl-product-", ""), { id: r.id, sku: r.sku }])
    );
    const existingInvoiceByExt = new Map(existingInvoices.map(r => [r.externalId!, r]));

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

      const pa = c.primary_address;
      const addrLine1 = pa?.line_1?.trim() ?? "";
      const addrMatch = addrLine1.match(/^(.*?)\s+(\d[\w\s\-/]*)$/);
      // Factuur-e-mail heeft voorrang, anders het hoofdadres
      const tlEmails = c.emails ?? [];
      const companyEmail =
        tlEmails.find((e) => e.type === "invoicing")?.email ??
        tlEmails.find((e) => e.type === "primary")?.email ??
        null;
      const customer = await prisma.customer.create({
        data: {
          customerNumber,
          companyName: c.name,
          email: companyEmail,
          vatNumber: c.vat_number ?? null,
          kvkNumber: c.national_identification_number ?? null,
          status: "ACTIVE",
          externalId,
          ...(c.added_at ? { createdAt: new Date(c.added_at) } : {}),
          ...(addrLine1
            ? {
                addresses: {
                  create: {
                    type: "BILLING",
                    isDefault: true,
                    street: addrMatch ? addrMatch[1] : addrLine1,
                    houseNumber: addrMatch ? addrMatch[2].trim() : "",
                    postalCode: pa?.postal_code ?? "",
                    city: pa?.city ?? "",
                    country: pa?.country ?? "NL",
                  },
                },
              }
            : {}),
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

      // Nummer overnemen uit TL-referentie (zoals bestaande data: D-<aanmaakjaar>-<ref, 4 cijfers>)
      const dealYear = d.created_at ? new Date(d.created_at).getFullYear() : year;
      const dealNumber = d.reference
        ? `D-${dealYear}-${String(d.reference).padStart(4, "0")}`
        : await nextDealNumber(year);
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
          ...(d.created_at ? { createdAt: new Date(d.created_at) } : {}),
        },
      });
      dealIdToLocalId.set(d.id, deal.id);
      counts.deals++;
    }
    console.log(`[import] Deals: ${counts.deals} nieuw, ${dealsSkippedExisting} al aanwezig, ${dealsSkippedNoCustomer} geen klant (company=${dealsSkipTypeCompany}, contact=${dealsSkipTypeContact}, geen=${dealsSkipTypeNone})`);

    // ── 5. Quotations → Quotes ───────────────────────────────────────────────
    const tlQuotations = await fetchQuotations(accessToken);
    let quotesSkippedExisting = 0, quotesSkippedNoCustomer = 0;
    let quoteSampleLogged = false;
    console.log(`[import] Teamleader offertes opgehaald: ${tlQuotations.length}, in DB: ${quotationIdToLocalId.size}`);

    for (const q of tlQuotations) {
      const externalId = `tl-quotation-${q.id}`;
      if (quotationIdToLocalId.has(q.id)) { quotesSkippedExisting++; continue; }

      if (!quoteSampleLogged) {
        console.log(`[import] eerste nieuwe offerte volledig:`, JSON.stringify(q));
        quoteSampleLogged = true;
      }

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
      const dealId = q.deal?.id ? (dealIdToLocalId.get(q.deal.id) ?? null) : null;

      // Deal ophalen voor klant-fallback én dealnummer (offertenummer volgt de deal)
      let linkedDealNumber: string | null = null;
      if (dealId) {
        const deal = await prisma.deal.findUnique({
          where: { id: dealId },
          select: { customerId: true, dealNumber: true },
        });
        if (!customerId) customerId = deal?.customerId ?? undefined;
        linkedDealNumber = deal?.dealNumber ?? null;
      }
      if (!customerId) { quotesSkippedNoCustomer++; continue; }
      const total    = q.total?.tax_inclusive?.amount ?? 0;
      const subtotal = q.total?.tax_exclusive?.amount ?? 0;
      const vatAmount = Math.max(total - subtotal, 0);

      // Offertenummer volgt de deal (TL toont "Offerte <dealref>"): Q-<jaar>-<dealref>
      // Bij meerdere offertes op één deal of botsing: suffix -2, -3, ...
      let quoteNumber: string;
      const dealNumMatch = linkedDealNumber?.match(/^D-(\d{4})-(\d+)$/);
      if (dealNumMatch) {
        const base = `Q-${dealNumMatch[1]}-${dealNumMatch[2].padStart(4, "0")}`;
        let cand = base;
        for (let n = 2; await prisma.quote.findUnique({ where: { quoteNumber: cand }, select: { id: true } }); n++) {
          cand = `${base}-${n}`;
        }
        quoteNumber = cand;
      } else {
        quoteNumber = await nextQuoteNumber(year);
      }
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
          ...(q.created_at ? { createdAt: new Date(q.created_at) } : {}),
        },
      });
      // Regels ophalen — die zitten niet in de list-response
      try {
        const info = await fetchQuotationInfo(accessToken, q.id);
        const items = (info?.grouped_lines ?? []).flatMap((g) => g.line_items ?? []);
        if (items.length > 0) {
          await prisma.quoteLine.createMany({
            data: items.map((item) => {
              const base = mapTlLineItem(item, productByTlId);
              const cost = Number(item.purchase_price?.amount ?? 0);
              return {
                quoteId: quote.id,
                ...base,
                costSnapshot: cost,
                expectedMarginSnapshot: Math.round((base.netLineTotal - base.qty * cost) * 100) / 100,
              };
            }),
          });
        }
      } catch (e) {
        console.warn(`[import] regels ophalen mislukt voor offerte ${q.id}:`, e instanceof Error ? e.message : e);
      }

      quotationIdToLocalId.set(q.id, quote.id);
      counts.quotes++;
    }
    console.log(`[import] Offertes: ${counts.quotes} nieuw, ${quotesSkippedExisting} al aanwezig, ${quotesSkippedNoCustomer} geen klant gevonden`);

    // ── 6. Invoices ──────────────────────────────────────────────────────────
    const tlInvoices = await fetchInvoices(accessToken);

    for (const inv of tlInvoices) {
      const externalId = `tl-invoice-${inv.id}`;
      const existingInv = existingInvoiceByExt.get(externalId);
      if (existingInv) {
        // Status bijwerken als die in Teamleader is veranderd (bv. betaald)
        const newStatus = mapInvoiceStatus(inv.status);
        // Dealkoppeling alsnog leggen als de deal inmiddels wél geïmporteerd is
        const resolvedDealId = inv.deal?.id ? (dealIdToLocalId.get(inv.deal.id) ?? null) : null;
        const needsDealLink = !existingInv.dealId && !!resolvedDealId;
        if (existingInv.status !== newStatus || needsDealLink) {
          const invTotal = inv.total?.tax_inclusive?.amount ?? Number(existingInv.total);
          const newPaid = newStatus === "PAID" ? invTotal : 0;
          await prisma.invoice.update({
            where: { id: existingInv.id },
            data: {
              status: newStatus,
              paidAmount: newPaid,
              openAmount: invTotal - newPaid,
              ...(needsDealLink ? { dealId: resolvedDealId } : {}),
            },
          });
          counts.invoicesUpdated++;
        }
        continue;
      }

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
      const createdInvoice = await prisma.invoice.create({
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

      // Regels ophalen — die zitten niet in de list-response
      try {
        const info = await fetchInvoiceInfo(accessToken, inv.id);
        const items = (info?.grouped_lines ?? []).flatMap((g) => g.line_items ?? []);
        if (items.length > 0) {
          await prisma.invoiceLine.createMany({
            data: items.map((item) => ({
              invoiceId: createdInvoice.id,
              ...mapTlLineItem(item, productByTlId),
            })),
          });
        }
      } catch (e) {
        console.warn(`[import] regels ophalen mislukt voor factuur ${inv.id}:`, e instanceof Error ? e.message : e);
      }
      counts.invoices++;
    }

    // ── 7. Credit notes ──────────────────────────────────────────────────────
    const tlCreditNotes = await fetchCreditNotes(accessToken);
    const existingCns = await prisma.creditNote.findMany({
      where: { externalId: { startsWith: "tl-creditnote-" } },
      select: { externalId: true },
    });
    const existingCnIds = new Set(existingCns.map((r) => r.externalId!));
    let cnSampleLogged = false;
    console.log(`[import] Teamleader creditnota's opgehaald: ${tlCreditNotes.length}, in DB: ${existingCnIds.size}`);

    for (const cn of tlCreditNotes) {
      const cnExternalId = `tl-creditnote-${cn.id}`;
      if (existingCnIds.has(cnExternalId)) continue;

      if (!cnSampleLogged) {
        console.log(`[import] eerste nieuwe creditnota volledig:`, JSON.stringify(cn));
        cnSampleLogged = true;
      }

      // Factuurkoppeling is verplicht in ons model
      const cnInvoice = cn.invoice?.id
        ? await prisma.invoice.findUnique({
            where: { externalId: `tl-invoice-${cn.invoice.id}` },
            select: { id: true, customerId: true },
          })
        : null;
      if (!cnInvoice) continue;

      const cnTotal    = cn.total?.tax_inclusive?.amount ?? 0;
      const cnSubtotal = cn.total?.tax_exclusive?.amount ?? 0;
      const cnVat      = Math.max(cnTotal - cnSubtotal, 0);
      const cnDate     = cn.credit_note_date ? new Date(cn.credit_note_date) : new Date();
      const cnYear     = cnDate.getFullYear();

      const tlCnNum = typeof cn.credit_note_number === "object"
        ? cn.credit_note_number?.number
        : cn.credit_note_number;
      let creditNoteNumber: string;
      if (tlCnNum) {
        const base = `CN-${cnYear}-${String(tlCnNum).padStart(3, "0")}`;
        let cand = base;
        for (let n = 2; await prisma.creditNote.findUnique({ where: { creditNoteNumber: cand }, select: { id: true } }); n++) {
          cand = `${base}-${n}`;
        }
        creditNoteNumber = cand;
      } else {
        creditNoteNumber = await nextCreditNoteNumber(cnYear);
      }

      await prisma.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: cnInvoice.id,
          customerId: cnInvoice.customerId,
          subtotal: cnSubtotal,
          vatAmount: cnVat,
          total: cnTotal,
          creditNoteDate: cnDate,
          createdBy: systemUserId,
          externalId: cnExternalId,
        },
      });
      counts.creditNotes++;
    }
    console.log(`[import] Creditnota's: ${counts.creditNotes} nieuw`);

    return NextResponse.json({ imported: counts });
  } catch (err) {
    console.error("Teamleader import error:", err);
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
