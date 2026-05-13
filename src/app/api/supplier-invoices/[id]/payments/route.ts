import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: supplierInvoiceId } = await params;

  const invoice = await prisma.supplierInvoice.findUnique({
    where: { id: supplierInvoiceId },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Inkoopfactuur niet gevonden" }, { status: 404 });
  }

  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Factuur is al volledig betaald" }, { status: 400 });
  }

  const body = await req.json();
  const { amount, paymentDate, reference } = body;

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: "Geldig bedrag is verplicht" }, { status: 400 });
  }

  const resolvedDate = paymentDate ? new Date(paymentDate) : new Date();

  const payment = await prisma.supplierPayment.create({
    data: {
      supplierInvoiceId,
      amount: Number(amount),
      paymentDate: resolvedDate,
      reference: reference?.trim() || null,
    },
  });

  // Recalculate paidAmount and openAmount
  const allPayments = await prisma.supplierPayment.findMany({
    where: { supplierInvoiceId },
    select: { amount: true },
  });

  const paidAmount = allPayments.reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(invoice.total);
  const openAmount = Math.max(0, total - paidAmount);

  let newStatus: "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "DISPUTED" = invoice.status;
  if (openAmount <= 0) {
    newStatus = "PAID";
  } else if (paidAmount > 0) {
    newStatus = "PARTIALLY_PAID";
  }

  await prisma.supplierInvoice.update({
    where: { id: supplierInvoiceId },
    data: {
      paidAmount,
      openAmount,
      status: newStatus,
    },
  });

  return NextResponse.json(payment, { status: 201 });
}
