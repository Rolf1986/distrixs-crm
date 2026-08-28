import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { syncInvoiceInstallments } from "@/lib/installments";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }

  // Een Twinfield-vergrendelde factuur mag WEL betalingen ontvangen; de lock
  // beschermt de factuurinhoud, niet de betaaladministratie.

  const body = await req.json();
  const { amount, paymentDate, method, reference } = body;

  const parsedAmount = Math.round(Number(amount) * 100) / 100;
  if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Geldig bedrag is verplicht" }, { status: 400 });
  }
  // Ruime bovengrens: niet meer dan het factuurtotaal + 1 euro marge
  if (parsedAmount > Number(invoice.total) + 1) {
    return NextResponse.json(
      { error: "Bedrag is hoger dan het factuurtotaal" },
      { status: 400 }
    );
  }

  const resolvedDate = paymentDate ? new Date(paymentDate) : new Date();
  const resolvedMethod = method ?? "BANK_TRANSFER";

  // Atomair: betaling aanmaken en totalen herberekenen in één transactie,
  // zodat gelijktijdige registraties elkaar niet overschrijven
  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        invoiceId,
        amount: parsedAmount,
        paymentDate: resolvedDate,
        method: resolvedMethod,
        reference: reference?.trim() || null,
        source: "MANUAL",
        createdBy: session.user.id,
      },
    });

    const allPayments = await tx.payment.findMany({
      where: { invoiceId },
      select: { amount: true },
    });

    const paidAmount = Math.round(allPayments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
    const total = Number(invoice.total);
    const openAmount = Math.max(0, Math.round((total - paidAmount) * 100) / 100);

    let newStatus = invoice.status;
    if (openAmount <= 0) {
      newStatus = "PAID";
    } else if (paidAmount > 0) {
      newStatus = "PARTIALLY_PAID";
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount,
        openAmount,
        status: newStatus,
      },
    });

    return created;
  });

  // Termijnen (indien aanwezig) bijwerken: vinkjes + vervaldatum
  await syncInvoiceInstallments(invoiceId);

  await logAudit({
    userId: session.user.id,
    action: "payment.created",
    entityType: "Invoice",
    entityId: invoiceId,
    newValue: { paymentId: payment.id, amount: parsedAmount },
  });

  return NextResponse.json(payment, { status: 201 });
}
