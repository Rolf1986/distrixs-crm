import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:          ["SENT"],
  SENT:           ["PAID", "PARTIALLY_PAID", "OVERDUE"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "SENT"],
  OVERDUE:        ["PAID", "PARTIALLY_PAID", "SENT"],
  PAID:           ["SENT"],   // correctie: terugzetten naar openstaand
  CREDITED:       [],
};

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
  const { status: newStatus } = body;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }

  if (invoice.twinfieldLocked) {
    return NextResponse.json(
      { error: "Factuur is vergrendeld door Twinfield en kan niet worden gewijzigd." },
      { status: 403 }
    );
  }

  const allowed = VALID_TRANSITIONS[invoice.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Statusovergang van ${invoice.status} naar ${newStatus} is niet toegestaan.` },
      { status: 400 }
    );
  }

  // Bij PAID: zet paidAmount = total en openAmount = 0, ongeacht geregistreerde betalingen
  // Dit representeert "handmatig afgevinkt als betaald" (bijv. contant, buiten systeem om)
  // Bij terugzetten naar SENT/OVERDUE: herbereken vanuit werkelijke betalingen
  let extraData: Record<string, unknown> = {};

  if (newStatus === "PAID") {
    const allPayments = await prisma.payment.findMany({
      where: { invoiceId: id },
      select: { amount: true },
    });
    const actualPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0);
    const total = Number(invoice.total);
    // Als er al betalingen zijn die het totaal dekken, gebruik die — anders zet alles op betaald
    extraData = {
      paidAmount: actualPaid >= total ? actualPaid : total,
      openAmount: 0,
    };
  } else if (newStatus === "SENT" || newStatus === "OVERDUE" || newStatus === "PARTIALLY_PAID") {
    // Herbereken vanuit werkelijke betalingen
    const allPayments = await prisma.payment.findMany({
      where: { invoiceId: id },
      select: { amount: true },
    });
    const actualPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0);
    const total = Number(invoice.total);
    extraData = {
      paidAmount: actualPaid,
      openAmount: Math.max(0, total - actualPaid),
    };
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: newStatus, ...extraData },
  });

  await logAudit({
    userId: session.user.id,
    action: "invoice.status_changed",
    entityType: "Invoice",
    entityId: id,
    oldValue: invoice.status,
    newValue: newStatus,
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
