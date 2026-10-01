import { prisma } from "@/lib/prisma";
import { getCompanyInfo } from "@/lib/companySettings";
import { isEuReverseCharge } from "@/lib/vat";

/**
 * Gedeelde PDF-databouwers: zorgen dat de download-route en de e-mailbijlage
 * exact dezelfde (moderne) PDF-layout gebruiken, incl. logo en klantgegevens.
 */


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
      installments: { orderBy: [{ dueDate: "asc" }, { installmentNumber: "asc" }] },
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
    // Uit de werkelijke datums, zodat de tekst altijd klopt met de vervaldatum
    paymentTermDays: Math.max(0, Math.round(
      (new Date(invoice.dueDate).getTime() - new Date(invoice.invoiceDate).getTime()) / 86400000
    )),
    ourReference: invoice.ourReference ?? invoice.deal?.orderReference ?? null,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
    openAmount: Number(invoice.openAmount),
    reverseCharge: isEuReverseCharge(addr?.country, invoice.customer.vatNumber),
    // Betalingsschema (termijnen) — leidend als ingevuld, zichtbaar op de PDF
    installments: invoice.installments.map((term) => ({
      installmentNumber: term.installmentNumber,
      dueDate: term.dueDate,
      amount: term.amount != null
        ? Number(term.amount)
        : Math.round(Number(invoice.total) * (Number(term.percentage ?? 0) / 100) * 100) / 100,
      percentage: term.percentage != null ? Number(term.percentage) : null,
      isPaid: term.isPaid,
      notes: term.notes,
    })),
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

export async function buildOrderConfirmationPdfData(ocId: string) {
  const oc = await prisma.orderConfirmation.findUnique({
    where: { id: ocId },
    include: {
      deal: { select: { title: true, orderReference: true } },
      quote: {
        select: {
          quoteNumber: true,
          language: true,
          subtotal: true,
          vatAmount: true,
          total: true,
          lines: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
        },
      },
      customer: {
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
          contacts: { where: { isPrimary: true, isActive: true }, take: 1 },
        },
      },
    },
  });
  if (!oc) return null;

  const company = await getCompanyInfo();
  const addr = pickAddress(oc.customer.addresses);
  const contact = oc.customer.contacts[0];

  // Leverdatum per regel (quoteLineId → ISO-datum)
  const lineDeliveries = (oc.lineDeliveries ?? {}) as Record<string, string>;

  const data = {
    language: oc.quote?.language ?? "NL",
    confirmationNumber: oc.confirmationNumber,
    confirmationDate: oc.confirmationDate,
    expectedDelivery: oc.expectedDelivery,
    projectName: oc.deal?.title ?? null,
    customerReference: oc.deal?.orderReference ?? null,
    quoteNumber: oc.quote?.quoteNumber ?? null,
    notes: oc.notes ?? null,
    subtotal: Number(oc.quote?.subtotal ?? 0),
    vatAmount: Number(oc.quote?.vatAmount ?? 0),
    total: Number(oc.quote?.total ?? 0),
    company,
    customer: {
      companyName: oc.customer.companyName,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      address: addr ? `${addr.street} ${addr.houseNumber}`.trim() : null,
      postalCode: addr?.postalCode ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
    },
    lines: (oc.quote?.lines ?? []).map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      qty: Number(l.qty),
      grossUnitPrice: Number(l.grossUnitPrice),
      discountPercent: Number(l.discountPercent),
      netLineTotal: Number(l.netLineTotal),
      deliveryDate: lineDeliveries[l.id] ?? null,
    })),
  };

  return { oc, company, data };
}

export async function buildDeliveryNotePdfData(dnId: string) {
  const dn = await prisma.deliveryNote.findUnique({
    where: { id: dnId },
    include: {
      customer: {
        include: {
          addresses: { where: { isDefault: true }, orderBy: { type: "asc" }, take: 2 },
        },
      },
      lines: { orderBy: { createdAt: "asc" } },
      deal: { select: { orderReference: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
  });
  if (!dn) return null;

  const company = await getCompanyInfo();
  const billingAddr = dn.customer.addresses.find((a) => a.type === "BILLING");
  const shippingAddr = dn.customer.addresses.find((a) => a.type === "SHIPPING");
  const defaultAddr = billingAddr ?? dn.customer.addresses[0];

  const data = {
    language: dn.language ?? "NL",
    noteNumber: dn.deliveryNumber,
    customerReference: dn.deal?.orderReference ?? null,
    deliveryDate: dn.deliveryDate ?? new Date(),
    notes: dn.notes,
    company,
    customer: {
      companyName: dn.customer.companyName,
      contactName: dn.contact ? `${dn.contact.firstName} ${dn.contact.lastName}` : null,
      address: defaultAddr ? `${defaultAddr.street} ${defaultAddr.houseNumber}` : null,
      postalCode: defaultAddr?.postalCode ?? null,
      city: defaultAddr?.city ?? null,
      country: defaultAddr?.country ?? null,
    },
    deliveryAddress: shippingAddr
      ? {
          companyName: dn.customer.companyName,
          address: `${shippingAddr.street} ${shippingAddr.houseNumber}`,
          postalCode: shippingAddr.postalCode,
          city: shippingAddr.city,
          country: shippingAddr.country,
        }
      : null,
    lines: dn.lines.map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      qty: Number(l.qty),
    })),
  };

  return { dn, company, data };
}
