import { prisma } from "@/lib/prisma";

/**
 * Snapshot-immutabiliteit: offertes en facturen mogen alleen in DRAFT
 * gewijzigd worden. Retourneert een foutmelding of null als bewerken mag.
 */
export async function assertQuoteEditable(quoteId: string): Promise<string | null> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { status: true },
  });
  if (!quote) return "Offerte niet gevonden";
  if (quote.status !== "DRAFT") {
    return "Offerte is verzonden en kan niet meer gewijzigd worden";
  }
  return null;
}

export async function assertInvoiceEditable(invoiceId: string): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, twinfieldLocked: true },
  });
  if (!invoice) return "Factuur niet gevonden";
  if (invoice.twinfieldLocked) {
    return "Factuur is vergrendeld na Twinfield-synchronisatie";
  }
  if (invoice.status !== "DRAFT") {
    return "Factuur is verzonden en kan niet meer gewijzigd worden";
  }
  return null;
}
