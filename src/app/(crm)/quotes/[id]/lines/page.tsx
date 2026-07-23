import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuoteLinesClient } from "./QuoteLinesClient";
import { defaultVatRateForCustomer } from "@/lib/vat";

async function getQuote(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      customer: {
        select: {
          vatNumber: true,
          addresses: { where: { type: "BILLING" }, orderBy: { isDefault: "desc" }, take: 1, select: { country: true } },
        },
      },
    },
  });
}

async function getProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, title: true, advisorySellPrice: true, baseCostPrice: true },
    orderBy: { title: "asc" },
  });
}

export default async function QuoteLinesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quote, products] = await Promise.all([getQuote(id), getProducts()]);
  if (!quote) notFound();

  const defaultVatRate = defaultVatRateForCustomer(
    quote.customer?.addresses[0]?.country,
    quote.customer?.vatNumber
  );

  // Offertes zijn altijd bewerkbaar (ook na verzenden/akkoord) — facturen
  // die eruit voortkwamen zijn losse snapshots en veranderen niet mee.
  return (
    <QuoteLinesClient
        quoteId={id}
        defaultVatRate={defaultVatRate}
        initialLines={quote.lines.map((l) => ({
          id: l.id,
          skuSnapshot: l.skuSnapshot,
          titleSnapshot: l.titleSnapshot,
          qty: Number(l.qty),
          grossUnitPrice: Number(l.grossUnitPrice),
          discountPercent: Number(l.discountPercent),
          netLineTotal: Number(l.netLineTotal),
          vatRate: Number(l.vatRate),
          vatAmount: Number(l.vatAmount),
          costSnapshot: Number(l.costSnapshot),
        }))}
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          title: p.title,
          advisorySellPrice: Number(p.advisorySellPrice),
          baseCostPrice: Number(p.baseCostPrice),
        }))}
      />
    );
}
