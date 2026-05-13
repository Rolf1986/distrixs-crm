import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { calcTotals, calcLineVat } from "@/lib/recalc";

function calcNetLineTotal(grossUnitPrice: number, qty: number, discountPercent: number) {
  return grossUnitPrice * qty * (1 - discountPercent / 100);
}

async function recalcQuoteTotals(quoteId: string) {
  const lines = await prisma.quoteLine.findMany({ where: { quoteId } });
  const { subtotal, vatAmount, total } = calcTotals(
    lines.map((l) => ({ netLineTotal: Number(l.netLineTotal), vatRate: Number(l.vatRate) }))
  );
  await prisma.quote.update({
    where: { id: quoteId },
    data: { subtotal, vatAmount, total },
  });
}

// Regel toevoegen
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: quoteId } = await params;
  const { productId, skuSnapshot, titleSnapshot, qty, grossUnitPrice, discountPercent, vatRate } = await req.json();

  if (!skuSnapshot || !titleSnapshot || !qty || grossUnitPrice === undefined) {
    return NextResponse.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
  }

  const discount = discountPercent ?? 0;
  const rate = vatRate !== undefined ? Number(vatRate) : 21;

  // Check customer-specific pricelist if productId is known
  let effectiveGrossPrice = Number(grossUnitPrice);
  if (productId) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { customerId: true } });
    if (quote) {
      const today = new Date();
      const plEntry = await prisma.customerPricelist.findUnique({
        where: { customerId_productId: { customerId: quote.customerId, productId } },
      });
      if (
        plEntry &&
        (!plEntry.validFrom || plEntry.validFrom <= today) &&
        (!plEntry.validUntil || plEntry.validUntil >= today)
      ) {
        if (plEntry.fixedPrice != null) {
          effectiveGrossPrice = Number(plEntry.fixedPrice);
        } else if (plEntry.discountPct != null) {
          effectiveGrossPrice = Number(grossUnitPrice) * (1 - Number(plEntry.discountPct) / 100);
        }
      }
    }
  }

  const netLineTotal = calcNetLineTotal(effectiveGrossPrice, Number(qty), Number(discount));
  const lineVatAmount = calcLineVat(netLineTotal, rate);

  // Haal inkoopprijs op van product
  let costSnapshot = 0;
  if (productId) {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { baseCostPrice: true } });
    costSnapshot = Number(product?.baseCostPrice ?? 0);
  }
  const expectedMarginSnapshot = netLineTotal - (Number(qty) * costSnapshot);

  const line = await prisma.quoteLine.create({
    data: {
      quoteId,
      productId: productId || null,
      skuSnapshot,
      titleSnapshot,
      qty: Number(qty),
      grossUnitPrice: effectiveGrossPrice,
      discountPercent: Number(discount),
      netLineTotal,
      vatRate: rate,
      vatAmount: lineVatAmount,
      costSnapshot,
      expectedMarginSnapshot,
    },
  });

  await recalcQuoteTotals(quoteId);
  return NextResponse.json(line);
}
