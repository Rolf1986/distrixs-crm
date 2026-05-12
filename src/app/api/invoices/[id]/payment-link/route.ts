import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Mollie betaallink genereren voor een factuur.
 *
 * Vereist MOLLIE_API_KEY in .env.local
 * Optioneel: NEXT_PUBLIC_APP_URL (standaard http://localhost:3000)
 */

interface MolliePaymentResponse {
  id: string;
  _links: {
    checkout: { href: string };
  };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const mollieKey = process.env.MOLLIE_API_KEY;
  if (!mollieKey) {
    return NextResponse.json(
      { error: "MOLLIE_API_KEY niet ingesteld in .env.local" },
      { status: 503 }
    );
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { customer: { select: { companyName: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }

  if (invoice.status === "PAID" || invoice.status === "CREDITED") {
    return NextResponse.json({ error: "Factuur is al betaald" }, { status: 400 });
  }

  const openAmount = Number(invoice.openAmount);
  if (openAmount <= 0) {
    return NextResponse.json({ error: "Geen openstaand bedrag" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Mollie Payment aanmaken via REST API
  const body = {
    amount: {
      currency: "EUR",
      value: openAmount.toFixed(2),
    },
    description: `${invoice.invoiceNumber} – ${invoice.customer.companyName}`,
    redirectUrl: `${appUrl}/invoices/${id}/payments?mollie=success`,
    webhookUrl: `${appUrl}/api/mollie/webhook`,
    metadata: {
      invoiceId: id,
      invoiceNumber: invoice.invoiceNumber,
    },
  };

  const mollieRes = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mollieKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!mollieRes.ok) {
    const err = await mollieRes.text();
    console.error("Mollie fout:", err);
    return NextResponse.json(
      { error: "Mollie betaling aanmaken mislukt", detail: err },
      { status: 502 }
    );
  }

  const payment = await mollieRes.json() as MolliePaymentResponse;
  const checkoutUrl = payment._links.checkout.href;

  // Sla de Mollie payment ID op in de factuurnotities (optioneel)
  await prisma.invoice.update({
    where: { id },
    data: {
      ourReference: invoice.ourReference
        ? invoice.ourReference
        : `Mollie: ${payment.id}`,
    },
  });

  return NextResponse.json({
    paymentId: payment.id,
    checkoutUrl,
  });
}
