import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// Verreken een creditnota met het openstaande bedrag van de gekoppelde
// factuur. Dit registreert een betaling (method OTHER) met een vast
// referentieformaat, zodat paidAmount/openAmount/status via de bestaande
// betalingslogica kloppen. Verwijderen van die betaling (betalingen-tab)
// maakt de verrekening ongedaan. (Route-bestanden mogen alleen HTTP-methods
// exporteren; het referentieformaat "Verrekening CN-…" wordt daarom ook in de
// pagina's als template herhaald.)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const cn = await prisma.creditNote.findUnique({
    where: { id },
    include: { invoice: { select: { id: true, invoiceNumber: true, status: true, total: true } } },
  });
  if (!cn) {
    return NextResponse.json({ error: "Creditnota niet gevonden" }, { status: 404 });
  }
  if (cn.invoice.status === "DRAFT") {
    return NextResponse.json(
      { error: "De factuur is nog een concept — verrekenen kan pas na verzenden." },
      { status: 400 }
    );
  }

  const amount = Math.abs(Number(cn.total));
  if (amount <= 0) {
    return NextResponse.json({ error: "Creditnota heeft geen bedrag om te verrekenen." }, { status: 400 });
  }

  const reference = `Verrekening ${cn.creditNoteNumber}`;
  const existing = await prisma.payment.findFirst({
    where: { invoiceId: cn.invoiceId, reference },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Deze creditnota is al verrekend met de factuur." }, { status: 400 });
  }

  await prisma.payment.create({
    data: {
      invoiceId: cn.invoiceId,
      paymentDate: new Date(),
      amount,
      method: "OTHER",
      source: "MANUAL",
      reference,
      createdBy: session.user.id,
    },
  });

  // Herbereken paidAmount / openAmount / status vanuit alle betalingen
  const payments = await prisma.payment.findMany({
    where: { invoiceId: cn.invoiceId },
    select: { amount: true },
  });
  const paidAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(cn.invoice.total);
  const openAmount = Math.max(0, total - paidAmount);

  let newStatus = cn.invoice.status;
  if (newStatus !== "CREDITED") {
    if (openAmount <= 0) newStatus = "PAID";
    else if (paidAmount > 0) newStatus = "PARTIALLY_PAID";
  }

  const updated = await prisma.invoice.update({
    where: { id: cn.invoiceId },
    data: { paidAmount, openAmount, status: newStatus },
  });

  await logAudit({
    userId: session.user.id,
    action: "credit_note.settled",
    entityType: "Invoice",
    entityId: cn.invoiceId,
    newValue: `${cn.creditNoteNumber} verrekend (€ ${amount.toFixed(2)}) met ${cn.invoice.invoiceNumber}`,
  });

  return NextResponse.json({
    ok: true,
    openAmount: Number(updated.openAmount),
    status: updated.status,
  });
}
