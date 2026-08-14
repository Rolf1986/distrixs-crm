import { prisma } from "@/lib/prisma";
import { getCompanyInfo } from "@/lib/companySettings";
import { isEuReverseCharge } from "@/lib/vat";

/**
 * Gedeelde PDF-databouwers: zorgen dat de download-route en de e-mailbijlage
 * exact dezelfde (moderne) PDF-layout gebruiken, incl. logo en klantgegevens.
 */

const PAYMENT_TERM_DAYS: Record<string, number> = {
  DAYS_14: 14,
  DAYS_30: 30,
  PREPAYMENT: 0,
};

type AddressRow = {
  type: string;
  isDefault: boolean;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

function pickAddress<T extends AddressRow>(addresses: T[]): T | undefined {
  return addresses.find((a) => a.type === "BILLING" && a.isDefault) ?? addresses[0];
}

export async function buildInvoicePdfData(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: {
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        },
      },
      contact: true,
      lines: { orderBy: { createdAt: "asc" } },
      deal: { select: { orderReference: true } },
    },
  });
  if (!invoice) return null;

  const company = await getCompanyInfo();
  const addr = pickAddress(invoice.customer.addresses);

  const data = {
    language: invoice.language ?? "NL",
    isDraft: invoice.status === "DRAFT",
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    paymentTermDays: PAYMENT_TERM_DAYS[invoice.paymentTermType] ?? 30,
    ourReference: invoice.ourReference ?? invoice.deal?.orderReference ?? null,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
    openAmount: Number(invoice.openAmount),
    reverseCharge: isEuReverseCharge(addr?.country, invoice.customer.vatNumber),
    company,
    customer: {
      companyName: invoice.customer.companyName,
      customerNumber: invoice.customer.customerNumber,
      contactName: invoice.contact
        ? `${invoice.contact.firstName} ${invoice.contact.lastName}`
        : null,
      address: addr ? `${addr.street} ${addr.houseNumber}`.trim() : null,
      postalCode: addr?.postalCode ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
      vatNumber: invoice.customer.vatNumber ?? null,
      kvkNumber: invoice.customer.kvkNumber ?? null,
    },
    lines: invoice.lines.map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      descriptionSnapshot: null,
      qty: Number(l.qty),
      grossUnitPrice: Number(l.grossUnitPrice),
      discountPercent: Number(l.discountPercent),
      netLineTotal: Number(l.netLineTotal),
    })),
  };

  return { invoice, company, data };
}

export async function buildCreditNotePdfData(creditNoteId: string) {
  const cn = await prisma.creditNote.findUnique({
    where: { id: creditNoteId },
    include: {
      customer: {
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        },
      },
      invoice: { select: { invoiceNumber: true } },
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!cn) return null;

  const company = await getCompanyInfo();
  const addr = pickAddress(cn.customer.addresses);

  const data = {
    language: cn.language ?? "NL",
    creditNoteNumber: cn.creditNoteNumber,
    creditNoteDate: cn.creditNoteDate,
    invoiceNumber: cn.invoice?.invoiceNumber ?? null,
    reason: cn.reason ?? null,
    subtotal: Number(cn.subtotal),
    vatAmount: Number(cn.vatAmount),
    total: Number(cn.total),
    company,
    customer: {
      companyName: cn.customer.companyName,
      customerNumber: cn.customer.customerNumber,
      address: addr ? `${addr.street} ${addr.houseNumber}`.trim() : null,
      postalCode: addr?.postalCode ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
      vatNumber: cn.customer.vatNumber ?? null,
      kvkNumber: cn.customer.kvkNumber ?? null,
    },
    lines: cn.lines.map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      qty: Number(l.qty),
      unitPrice: Number(l.unitPrice),
      vatRate: Number(l.vatRate),
      lineTotal: Number(l.lineTotal),
    })),
  };

  return { creditNote: cn, company, data };
}

export async function buildQuotePdfData(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      customer: {
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        },
      },
      contact: true,
      deal: { select: { title: true, orderReference: true } },
      lines: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!quote) return null;

  const company = await getCompanyInfo();
  const addr = pickAddress(quote.customer.addresses);

  const data = {
    language: quote.language ?? "NL",
    quoteNumber: quote.quoteNumber,
    projectName: quote.deal?.title,
    customerReference: quote.deal?.orderReference ?? null,
    publicNote: quote.publicNote ?? null,
    quoteDate: quote.quoteDate,
    validUntil: quote.validUntil,
    subtotal: Number(quote.subtotal),
    vatAmount: Number(quote.vatAmount),
    total: Number(quote.total),
    reverseCharge: isEuReverseCharge(addr?.country, quote.customer.vatNumber),
    company,
    customer: {
      companyName: quote.customer.companyName,
      contactName: quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName}` : null,
      email: quote.contact?.email ?? null,
      address: addr ? `${addr.street} ${addr.houseNumber}`.trim() : null,
      postalCode: addr?.postalCode ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
      vatNumber: quote.customer.vatNumber ?? null,
      kvkNumber: quote.customer.kvkNumber ?? null,
    },
    lines: quote.lines.map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      descriptionSnapshot: null,
      qty: Number(l.qty),
      grossUnitPrice: Number(l.grossUnitPrice),
      discountPercent: Number(l.discountPercent),
      netLineTotal: Number(l.netLineTotal),
    })),
  };

  return { quote, company, data };
}
