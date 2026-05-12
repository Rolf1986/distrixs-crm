import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextPurchaseOrderNumber } from "@/lib/sequences";

// Standalone PO aanmaken (niet vanuit een deal)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { supplierId, dealId, notes } = await req.json();
  if (!supplierId) return NextResponse.json({ error: "Leverancier verplicht" }, { status: 400 });

  const year = new Date().getFullYear();
  const poNumber = await nextPurchaseOrderNumber(year);

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId,
      dealId: dealId || null,
      status: "DRAFT",
      orderDate: new Date(),
      notes: notes || null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ id: po.id, poNumber: po.poNumber });
}
