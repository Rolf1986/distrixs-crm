import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Leverancier en andere velden bijwerken
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      ...(body.supplierId !== undefined && { supplierId: body.supplierId }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.dealId !== undefined && { dealId: body.dealId || null }),
    },
    include: { supplier: { select: { name: true, supplierType: true } } },
  });

  return NextResponse.json(po);
}
