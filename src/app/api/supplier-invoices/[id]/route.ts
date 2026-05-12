import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.supplierInvoice.findUnique({
    where: { id },
    include: {
      supplier: { select: { name: true, supplierType: true } },
      purchaseOrder: { select: { poNumber: true } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Inkoopfactuur niet gevonden" }, { status: 404 });
  }

  return NextResponse.json(invoice);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ("status" in body) data.status = body.status;
  if ("notes" in body) data.notes = body.notes ?? null;

  const invoice = await prisma.supplierInvoice.update({ where: { id }, data });
  return NextResponse.json(invoice);
}
