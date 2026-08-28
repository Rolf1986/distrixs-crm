import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { syncInvoiceInstallments } from "@/lib/installments";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: invoiceId, paymentId } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });

  // Betaaladministratie mag ook op een Twinfield-vergrendelde factuur (de lock
  // beschermt de factuurinhoud, niet de betalingen).

  // Fetch payment amount before deletion for audit log
  const paymentToDelete = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { amount: true },
  });

  await prisma.payment.delete({ where: { id: paymentId } });

  // Herbereken paidAmount / openAmount / status
  const remaining = await prisma.payment.findMany({
    where: { invoiceId },
    select: { amount: true },
  });

  const paidAmount = remaining.reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(invoice.total);
  const openAmount = Math.max(0, total - paidAmount);

  let newStatus = invoice.status;
  if (openAmount <= 0) newStatus = "PAID";
  else if (paidAmount > 0) newStatus = "PARTIALLY_PAID";
  else newStatus = invoice.status === "PAID" || invoice.status === "PARTIALLY_PAID" ? "SENT" : invoice.status;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount, openAmount, status: newStatus },
  });

  await syncInvoiceInstallments(invoiceId);

  await logAudit({
    userId: session.user.id,
    action: "payment.deleted",
    entityType: "Invoice",
    entityId: invoiceId,
    oldValue: {
      paymentId,
      amount: paymentToDelete ? Number(paymentToDelete.amount) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
