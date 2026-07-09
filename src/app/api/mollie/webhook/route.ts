import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMollieKey } from "@/lib/mollie";

/**
 * Mollie webhook — wordt aangeroepen door Mollie als een betaling van status verandert.
 * Geen auth vereist (Mollie roept dit zelf aan).
 *
 * Docs: https://docs.mollie.com/docs/webhooks
 */

interface MolliePaymentDetails {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  amountRefunded?: { value: string };
  metadata?: { invoiceId?: string };
}

export async function POST(req: NextRequest) {
  const mollieKey = await getMollieKey();
  if (!mollieKey) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let paymentId: string | undefined;
  try {
    const body = await req.formData();
    paymentId = body.get("id") as string;
  } catch {
    // Mollie stuurt soms ook JSON
    try {
      const json = await req.json() as { id?: string };
      paymentId = json.id;
    } catch { /* ignore */ }
  }

  if (!paymentId) {
    return NextResponse.json({ error: "Geen payment ID" }, { status: 400 });
  }

  // Haal actuele status op bij Mollie
  const mollieRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mollieKey}` },
  });

  if (!mollieRes.ok) {
    console.error("Mollie webhook: kon payment niet ophalen", paymentId);
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const payment = await mollieRes.json() as MolliePaymentDetails;
  const invoiceId = payment.metadata?.invoiceId;

  if (!invoiceId) {
    // Geen bekende factuur — negeer
    return NextResponse.json({ ok: true });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return NextResponse.json({ ok: true });
  }

  // Verwerk betaling op basis van Mollie status
  if (payment.status === "paid") {
    // Alleen EUR verwerken — voorkomt valuta-verwarring bij vreemde betalingen
    if (payment.amount.currency !== "EUR") {
      console.warn(`[mollie] betaling ${paymentId} in ${payment.amount.currency} genegeerd (alleen EUR)`);
      return NextResponse.json({ ok: true });
    }
    const reference = `Mollie ${paymentId}`;

    // Idempotent: Mollie herhaalt webhooks — zelfde betaling nooit dubbel registreren
    const alreadyProcessed = await prisma.payment.findFirst({
      where: { invoiceId, reference },
      select: { id: true },
    });
    if (alreadyProcessed) {
      return NextResponse.json({ ok: true });
    }

    const paidAmount = Math.round(parseFloat(payment.amount.value) * 100) / 100;
    const systemUser = await prisma.user.findFirst({ select: { id: true } });

    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId,
          amount: paidAmount,
          paymentDate: new Date(),
          method: "BANK_TRANSFER",
          reference,
          createdBy: systemUser!.id,
        },
      });

      // Totaal herberekenen uit álle betalingen (niet optellen bij oude stand)
      const allPayments = await tx.payment.findMany({
        where: { invoiceId },
        select: { amount: true },
      });
      const newPaid = Math.round(allPayments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
      const newOpen = Math.max(0, Math.round((Number(invoice.total) - newPaid) * 100) / 100);
      const newStatus = newOpen <= 0.01 ? "PAID" : "PARTIALLY_PAID";

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaid,
          openAmount: newOpen,
          status: newStatus,
        },
      });

      console.log(`Mollie webhook: factuur ${invoice.invoiceNumber} → ${newStatus} (€ ${paidAmount})`);
    });
  }

  return NextResponse.json({ ok: true });
}
