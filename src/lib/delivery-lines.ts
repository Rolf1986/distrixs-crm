import { prisma } from "@/lib/prisma";

export interface DeliveryLineCandidate {
  skuSnapshot: string;
  titleSnapshot: string;
  qty: number;
}

// Welke artikelregels horen op een verzenddocument voor deze deal?
// Volgorde: offerte van de gekoppelde orderbevestiging → recentste
// geaccepteerde offerte → verzonden → willekeurige offerte → recentste
// factuur. Ook de taal van de bron gaat mee (NL/EN op de PDF).
export async function resolveDeliveryLines(
  dealId: string,
  confirmationId?: string | null
): Promise<{ lines: DeliveryLineCandidate[]; language: string }> {
  let sourceQuoteId: string | null = null;
  if (confirmationId) {
    const oc = await prisma.orderConfirmation.findUnique({
      where: { id: confirmationId },
      select: { quoteId: true },
    });
    sourceQuoteId = oc?.quoteId ?? null;
  }
  if (!sourceQuoteId) {
    const quote =
      (await prisma.quote.findFirst({
        where: { dealId, status: "ACCEPTED" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })) ??
      (await prisma.quote.findFirst({
        where: { dealId, status: "SENT" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })) ??
      // Ook een concept-offerte is beter dan een leeg verzenddocument
      (await prisma.quote.findFirst({
        where: { dealId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }));
    sourceQuoteId = quote?.id ?? null;
  }

  let language = "NL";
  let lines: DeliveryLineCandidate[] = [];

  if (sourceQuoteId) {
    const rows = await prisma.quoteLine.findMany({
      where: { quoteId: sourceQuoteId },
      select: { skuSnapshot: true, titleSnapshot: true, qty: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    lines = rows
      .map((l) => ({
        skuSnapshot: l.skuSnapshot,
        titleSnapshot: l.titleSnapshot,
        qty: Number(l.qty),
      }))
      // tekst-/lege regels (aantal 0) horen niet op een verzenddocument
      .filter((l) => l.qty > 0);
    const q = await prisma.quote.findUnique({
      where: { id: sourceQuoteId },
      select: { language: true },
    });
    if (q?.language === "EN") language = "EN";
  }

  // Laatste redmiddel: regels van de recentste factuur van de deal
  if (lines.length === 0) {
    const invoice = await prisma.invoice.findFirst({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      select: { id: true, language: true },
    });
    if (invoice) {
      const rows = await prisma.invoiceLine.findMany({
        where: { invoiceId: invoice.id },
        select: { skuSnapshot: true, titleSnapshot: true, qty: true },
        orderBy: { createdAt: "asc" },
      });
      lines = rows.map((l) => ({
        skuSnapshot: l.skuSnapshot,
        titleSnapshot: l.titleSnapshot,
        qty: Number(l.qty),
      }));
      if (invoice.language === "EN") language = "EN";
    }
  }

  return { lines, language };
}
