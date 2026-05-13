import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Regel verwijderen
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { lineId } = await params;

  await prisma.purchaseOrderLine.delete({ where: { id: lineId } });

  return NextResponse.json({ success: true });
}

// Regel bijwerken (qty, baseCost)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { lineId } = await params;
  const body = await req.json();

  const line = await prisma.purchaseOrderLine.update({
    where: { id: lineId },
    data: {
      ...(body.qtyOrdered !== undefined && { qtyOrdered: Number(body.qtyOrdered) }),
      ...(body.qtyReceived !== undefined && { qtyReceived: Number(body.qtyReceived) }),
      ...(body.baseCostSnapshot !== undefined && { baseCostSnapshot: Number(body.baseCostSnapshot) }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json(line);
}
