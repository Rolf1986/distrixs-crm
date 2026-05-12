import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
  await prisma.quote.update({ where: { id: quoteId }, data: { subtotal, vatAmount, total } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: quoteId, lineId } = await params;
  const body = await req.json();

  const existing = await prisma.quoteLine.findUnique({ where: { id: lineId } });
  if (!existing) return NextResponse.json({ error: "Regel niet gevonden" }, { status: 404 });

  const grossUnitPrice = body.grossUnitPrice !== undefined ? Number(body.grossUnitPrice) : Number(existing.grossUnitPrice);
  const qty = body.qty !== undefined ? Number(body.qty) : Number(existing.qty);
  const discountPercent = body.discountPercent !== undefined ? Number(body.discountPercent) : Number(existing.discountPercent);
  const vatRate = body.vatRate !== undefined ? Number(body.vatRate) : Number(existing.vatRate);
  const netLineTotal = calcNetLineTotal(grossUnitPrice, qty, discountPercent);
  const lineVatAmount = calcLineVat(netLineTotal, vatRate);

  // Herbereken margin op basis van bestaande costSnapshot
  const costSnapshot = Number(existing.costSnapshot ?? 0);
  const expectedMarginSnapshot = netLineTotal - (qty * costSnapshot);

  const line = await prisma.quoteLine.update({
    where: { id: lineId },
    data: {
      ...(body.titleSnapshot !== undefined && { titleSnapshot: body.titleSnapshot }),
      ...(body.skuSnapshot !== undefined && { skuSnapshot: body.skuSnapshot }),
      grossUnitPrice,
      qty,
      discountPercent,
      vatRate,
      netLineTotal,
      vatAmount: lineVatAmount,
      expectedMarginSnapshot,
    },
  });

  await recalcQuoteTotals(quoteId);
  return NextResponse.json(line);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: quoteId, lineId } = await params;
  await prisma.quoteLine.delete({ where: { id: lineId } });
  await recalcQuoteTotals(quoteId);
  return NextResponse.json({ success: true });
}
