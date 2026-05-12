import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUnitPrice, calcNetLineTotal } from "@/lib/pricing";
import { calcExpectedMargin } from "@/lib/margin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: dealId } = await params;
  const body = await req.json();
  const { productId, qty, grossUnitPriceOverride, discountPercent = 0 } = body;

  if (!productId || !qty || Number(qty) <= 0) {
    return NextResponse.json({ error: "Ongeldig product of aantal" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      supplier: { select: { id: true, supplierType: true } },
      priceTiers: true,
    },
  });

  if (!product || !product.isActive) {
    return NextResponse.json({ error: "Product niet gevonden" }, { status: 404 });
  }

  const qtyNum = Number(qty);
  const grossUnitPrice =
    grossUnitPriceOverride != null
      ? Number(grossUnitPriceOverride)
      : resolveUnitPrice(qtyNum, Number(product.advisorySellPrice), product.priceTiers);

  const discountPct = Number(discountPercent);
  const netLineTotal = calcNetLineTotal(grossUnitPrice, qtyNum, discountPct);
  const netUnitPrice = grossUnitPrice * (1 - discountPct / 100);

  const isChina = product.supplier.supplierType === "CHINA";
  const baseCostPerUnit = Number(product.baseCostPrice);
  const { expectedMargin: marginPerUnit } = calcExpectedMargin(netUnitPrice, baseCostPerUnit, isChina);

  const baseCostSnapshot = baseCostPerUnit;
  const chinaFactor = isChina ? 1.14 : 1; // 8% shipping + 6% import
  const expectedCostTotal = baseCostPerUnit * chinaFactor * qtyNum;
  const expectedMarginTotal = netLineTotal - expectedCostTotal;

  const line = await prisma.dealLine.create({
    data: {
      dealId,
      productId,
      skuSnapshot: product.sku,
      titleSnapshot: product.title,
      supplierIdSnapshot: product.supplier.id,
      supplierTypeSnapshot: product.supplier.supplierType,
      qty: qtyNum,
      grossUnitPrice,
      discountPercent: discountPct,
      netLineTotal,
      baseCostSnapshot,
      expectedCostTotal,
      expectedMarginTotal,
    },
    include: { product: { select: { sku: true, unit: true } } },
  });

  return NextResponse.json(line, { status: 201 });
}
