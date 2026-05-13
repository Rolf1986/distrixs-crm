import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  const mollieKey = process.env.MOLLIE_API_KEY;
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
    const paidAmount = parseFloat(payment.amount.value);
    const newPaid = Number(invoice.paidAmount) + paidAmount;
    const newOpen = Math.max(0, Number(invoice.total) - newPaid);
    const newStatus = newOpen <= 0.01 ? "PAID" : "PARTIALLY_PAID";

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaid,
        openAmount: newOpen,
        status: newStatus,
      },
    });

    // Leg betaling vast
    await prisma.payment.create({
      data: {
        invoiceId,
        amount: paidAmount,
        paymentDate: new Date(),
        method: "BANK_TRANSFER",
        reference: `Mollie ${paymentId}`,
        createdBy: (await prisma.user.findFirst({ select: { id: true } }))!.id,
      },
    });

    console.log(`Mollie webhook: factuur ${invoice.invoiceNumber} → ${newStatus} (€ ${paidAmount})`);
  }

  return NextResponse.json({ ok: true });
}
