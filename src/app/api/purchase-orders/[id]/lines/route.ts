import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Regel toevoegen aan PO
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const { productId, qtyOrdered, baseCostOverride } = await req.json();

  if (!productId || !qtyOrdered) {
    return NextResponse.json({ error: "Product en aantal verplicht" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { sku: true, title: true, baseCostPrice: true, supplierId: true },
  });
  if (!product) return NextResponse.json({ error: "Product niet gevonden" }, { status: 404 });

  const baseCost = baseCostOverride !== undefined
    ? Number(baseCostOverride)
    : Number(product.baseCostPrice);

  const line = await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: id,
      productId,
      skuSnapshot: product.sku,
      titleSnapshot: product.title,
      qtyOrdered: Number(qtyOrdered),
      qtyReceived: 0,
      baseCostSnapshot: baseCost,
      status: "PENDING",
    },
  });

  return NextResponse.json(line);
}
