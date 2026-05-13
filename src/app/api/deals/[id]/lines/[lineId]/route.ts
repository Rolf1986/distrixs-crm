import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { calcNetLineTotal } from "@/lib/pricing";
import { calcExpectedMargin } from "@/lib/margin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { lineId } = await params;
  const body = await req.json();

  const existing = await prisma.dealLine.findUnique({
    where: { id: lineId },
    include: { product: { include: { supplier: { select: { supplierType: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const qty = body.qty != null ? Number(body.qty) : Number(existing.qty);
  const grossUnitPrice =
    body.grossUnitPrice != null ? Number(body.grossUnitPrice) : Number(existing.grossUnitPrice);
  const discountPercent =
    body.discountPercent != null ? Number(body.discountPercent) : Number(existing.discountPercent);

  const netLineTotal = calcNetLineTotal(grossUnitPrice, qty, discountPercent);
  const netUnitPrice = grossUnitPrice * (1 - discountPercent / 100);
  const isChina = existing.product.supplier.supplierType === "CHINA";
  const baseCostPerUnit = Number(existing.baseCostSnapshot);
  const chinaFactor = isChina ? 1.14 : 1;
  const expectedCostTotal = baseCostPerUnit * chinaFactor * qty;
  const expectedMarginTotal = netLineTotal - expectedCostTotal;

  const line = await prisma.dealLine.update({
    where: { id: lineId },
    data: { qty, grossUnitPrice, discountPercent, netLineTotal, expectedCostTotal, expectedMarginTotal },
  });

  return NextResponse.json(line);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { lineId } = await params;
  await prisma.dealLine.delete({ where: { id: lineId } });
  return new NextResponse(null, { status: 204 });
}
