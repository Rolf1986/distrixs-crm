import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Zelfde bescherming als de hoofdroute: geen wijzigingen op betaalde/
// gecrediteerde of Twinfield-gelockte facturen.
async function assertInstallmentsEditable(invoiceId: string): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, twinfieldLocked: true },
  });
  if (!invoice) return "Factuur niet gevonden";
  if (invoice.twinfieldLocked) return "Factuur is vergrendeld na Twinfield-synchronisatie";
  if (invoice.status === "PAID" || invoice.status === "CREDITED") {
    return "Termijnen kunnen niet gewijzigd worden op een betaalde of gecrediteerde factuur";
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id, installmentId } = await params;

  const body = await req.json() as {
    dueDate?: string;
    percentage?: number | null;
    amount?: number | null;
    isPaid?: boolean;
    notes?: string | null;
  };

  // Structurele wijzigingen (bedrag/%/datum) blokkeren op betaalde/gelockte facturen.
  // Het aan/uit vinken van "betaald" is een betaalactie en mag altijd (voor correctie).
  const isOnlyPaidToggle =
    body.isPaid !== undefined &&
    body.dueDate === undefined && body.percentage === undefined &&
    body.amount === undefined && body.notes === undefined;
  if (!isOnlyPaidToggle) {
    const guardError = await assertInstallmentsEditable(id);
    if (guardError) return NextResponse.json({ error: guardError }, { status: 409 });
  }

  const existing = await prisma.invoiceInstallment.findUnique({ where: { id: installmentId } });
  if (!existing) return NextResponse.json({ error: "Termijn niet gevonden" }, { status: 404 });

  const updated = await prisma.invoiceInstallment.update({
    where: { id: installmentId },
    data: {
      dueDate:    body.dueDate    ? new Date(body.dueDate) : undefined,
      percentage: "percentage" in body ? (body.percentage ?? null) : undefined,
      amount:     "amount"     in body ? (body.amount ?? null)     : undefined,
      isPaid:     body.isPaid   !== undefined ? body.isPaid : undefined,
      notes:      "notes"      in body ? (body.notes ?? null)      : undefined,
    },
  });

  // "Betaald" aan/uit → automatisch een betaling boeken/verwijderen zodat het
  // openstaande bedrag klopt. Referentie is uniek per termijn.
  if (body.isPaid !== undefined && body.isPaid !== existing.isPaid) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { total: true, status: true },
    });
    if (invoice) {
      const reference = `Termijn ${existing.installmentNumber}`;
      // Euro-bedrag van deze termijn: vast bedrag heeft voorrang, anders % van totaal
      const instAmount = updated.amount != null
        ? Number(updated.amount)
        : updated.percentage != null
        ? Math.round((Number(updated.percentage) / 100) * Number(invoice.total) * 100) / 100
        : 0;

      await prisma.$transaction(async (tx) => {
        if (body.isPaid && instAmount > 0) {
          // Alleen aanmaken als er nog geen betaling voor deze termijn is
          const dup = await tx.payment.findFirst({ where: { invoiceId: id, reference }, select: { id: true } });
          if (!dup) {
            await tx.payment.create({
              data: {
                invoiceId: id,
                amount: instAmount,
                paymentDate: new Date(),
                method: "BANK_TRANSFER",
                source: "MANUAL",
                reference,
                createdBy: session.user.id,
              },
            });
          }
        } else {
          // Ontvinken → de bijbehorende termijn-betaling weer verwijderen
          await tx.payment.deleteMany({ where: { invoiceId: id, reference } });
        }

        // Totalen herberekenen uit álle betalingen
        const all = await tx.payment.findMany({ where: { invoiceId: id }, select: { amount: true } });
        const paid = Math.round(all.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
        const open = Math.max(0, Math.round((Number(invoice.total) - paid) * 100) / 100);
        const newStatus = open <= 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : (invoice.status === "PAID" || invoice.status === "PARTIALLY_PAID" ? "SENT" : invoice.status);
        await tx.invoice.update({
          where: { id },
          data: { paidAmount: paid, openAmount: open, status: newStatus },
        });
      });
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id, installmentId } = await params;
  const guardError = await assertInstallmentsEditable(id);
  if (guardError) return NextResponse.json({ error: guardError }, { status: 409 });

  await prisma.invoiceInstallment.delete({ where: { id: installmentId } });
  return NextResponse.json({ ok: true });
}
