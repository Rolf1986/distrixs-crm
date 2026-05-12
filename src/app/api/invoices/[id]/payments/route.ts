import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }

  if (invoice.twinfieldLocked) {
    return NextResponse.json(
      { error: "Factuur is vergrendeld via Twinfield" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { amount, paymentDate, method, reference } = body;

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: "Geldig bedrag is verplicht" }, { status: 400 });
  }

  const resolvedDate = paymentDate ? new Date(paymentDate) : new Date();
  const resolvedMethod = method ?? "BANK_TRANSFER";

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount: Number(amount),
      paymentDate: resolvedDate,
      method: resolvedMethod,
      reference: reference?.trim() || null,
      source: "MANUAL",
      createdBy: session.user.id,
    },
  });

  // Recalculate paidAmount and openAmount
  const allPayments = await prisma.payment.findMany({
    where: { invoiceId },
    select: { amount: true },
  });

  const paidAmount = allPayments.reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(invoice.total);
  const openAmount = Math.max(0, total - paidAmount);

  let newStatus = invoice.status;
  if (openAmount <= 0) {
    newStatus = "PAID";
  } else if (paidAmount > 0) {
    newStatus = "PARTIALLY_PAID";
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount,
      openAmount,
      status: newStatus,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "payment.created",
    entityType: "Invoice",
    entityId: invoiceId,
    newValue: { paymentId: payment.id, amount: Number(amount) },
  });

  return NextResponse.json(payment, { status: 201 });
}
