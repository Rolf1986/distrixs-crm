import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextPurchaseOrderNumber } from "@/lib/sequences";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: dealId } = await params;
  const body = await req.json().catch(() => ({})) as { supplierId?: string };

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

  const year = new Date().getFullYear();
  const poNumber = await nextPurchaseOrderNumber(year);

  // Maak een lege concept-inkooporder aan — regels worden later toegevoegd
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      dealId,
      supplierId: body.supplierId,
      status: "DRAFT",
      orderDate: new Date(),
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ id: po.id, poNumber: po.poNumber });
}
