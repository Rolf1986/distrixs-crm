import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextInvoiceNumber } from "@/lib/sequences";
import { syncInvoiceToTwinfield, isTwinfieldAutoSyncEnabled } from "@/lib/twinfield";

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
  const session = await getSession(req);
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

  // Let op: een Twinfield-vergrendelde factuur mag WEL van betaalstatus wijzigen
  // (betaald/deels betaald/verlopen). De lock beschermt de inhoud (regels/
  // bedragen), niet het registreren van betalingen.

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

  // Concept dat (handmatig) op verzonden wordt gezet krijgt zijn definitieve
  // factuurnummer — net als bij verzenden via e-mail.
  if (invoice.status === "DRAFT" && newStatus === "SENT" && invoice.invoiceNumber.startsWith("DRAFT-")) {
    extraData.invoiceNumber = await nextInvoiceNumber(new Date().getFullYear());
    // Factuurdatum = boekdatum (vandaag), niet de dag waarop het concept
    // werd aangemaakt; vervaldatum schuift mee met de betaaltermijn.
    const TERM_DAYS: Record<string, number> = { DAYS_14: 14, DAYS_30: 30, PREPAYMENT: 0, INSTALLMENTS: 30 };
    const bookDate = new Date();
    const newDue = new Date(bookDate);
    newDue.setDate(newDue.getDate() + (TERM_DAYS[invoice.paymentTermType] ?? 14));
    extraData.invoiceDate = bookDate;
    extraData.dueDate = newDue;
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

  // Concept dat op verzonden wordt gezet → automatisch naar Twinfield boeken
  // (fail-soft; al geboekte facturen worden overgeslagen).
  if (invoice.status === "DRAFT" && newStatus === "SENT" && await isTwinfieldAutoSyncEnabled()) {
    try {
      const tf = await syncInvoiceToTwinfield(id);
      if (!tf.success) console.warn(`[invoice status] Twinfield-boeking mislukt voor ${updated.invoiceNumber}: ${tf.error}`);
    } catch (e) {
      console.warn(`[invoice status] Twinfield-boeking fout voor ${updated.invoiceNumber}:`, e);
    }
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
