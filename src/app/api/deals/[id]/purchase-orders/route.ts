import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nextPurchaseOrderNumber } from "@/lib/sequences";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: dealId } = await params;
  const body = await req.json().catch(() => ({})) as {
    supplierId?: string;
    lines?: Array<{ productId?: string; qty?: number }>;
  };

  if (!body.supplierId) {
    return NextResponse.json({ error: "Kies een leverancier" }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true },
  });

  if (!deal) {
    return NextResponse.json({ error: "Deal niet gevonden" }, { status: 404 });
  }

  // Geselecteerde dealproducten worden direct als PO-regels aangemaakt
  const requestedLines = (body.lines ?? []).filter(
    (l): l is { productId: string; qty: number } =>
      typeof l.productId === "string" && typeof l.qty === "number" && l.qty > 0
  );
  const products = requestedLines.length
    ? await prisma.product.findMany({
        where: { id: { in: requestedLines.map((l) => l.productId) } },
        select: { id: true, sku: true, title: true, baseCostPrice: true },
      })
    : [];
  const productById = new Map(products.map((p) => [p.id, p]));

  const year = new Date().getFullYear();
  const poNumber = await nextPurchaseOrderNumber(year);

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      dealId,
      supplierId: body.supplierId,
      status: "DRAFT",
      orderDate: new Date(),
      createdBy: session.user.id,
      lines: {
        create: requestedLines
          .filter((l) => productById.has(l.productId))
          .map((l) => {
            const p = productById.get(l.productId)!;
            return {
              productId: p.id,
              skuSnapshot: p.sku,
              titleSnapshot: p.title,
              qtyOrdered: l.qty,
              baseCostSnapshot: p.baseCostPrice,
            };
          }),
      },
    },
  });

  return NextResponse.json({ id: po.id, poNumber: po.poNumber });
}
