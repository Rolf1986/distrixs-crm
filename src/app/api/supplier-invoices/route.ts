import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const invoices = await prisma.supplierInvoice.findMany({
    include: {
      supplier: { select: { name: true } },
      purchaseOrder: { select: { poNumber: true } },
    },
    orderBy: { invoiceDate: "desc" },
  });

  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json();
  const {
    supplierId,
    purchaseOrderId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    subtotal,
    vatAmount,
    total,
    notes,
  } = body;

  if (!supplierId) {
    return NextResponse.json({ error: "Leverancier verplicht" }, { status: 400 });
  }
  if (!invoiceNumber?.trim()) {
    return NextResponse.json({ error: "Factuurnummer verplicht" }, { status: 400 });
  }
  if (!invoiceDate) {
    return NextResponse.json({ error: "Factuurdatum verplicht" }, { status: 400 });
  }
  if (!dueDate) {
    return NextResponse.json({ error: "Vervaldatum verplicht" }, { status: 400 });
  }

  const totalNum = Number(total);
  const subtotalNum = Number(subtotal) || 0;
  const vatNum = Number(vatAmount) || 0;

  if (isNaN(totalNum) || totalNum <= 0) {
    return NextResponse.json({ error: "Geldig totaalbedrag verplicht" }, { status: 400 });
  }

  const invoice = await prisma.supplierInvoice.create({
    data: {
      supplierId,
      purchaseOrderId: purchaseOrderId || null,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate: new Date(invoiceDate),
      dueDate: new Date(dueDate),
      subtotal: subtotalNum,
      vatAmount: vatNum,
      total: totalNum,
      paidAmount: 0,
      openAmount: totalNum,
      status: "OPEN",
      notes: notes?.trim() || null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
