import { prisma } from "@/lib/prisma";

/**
 * Mollie-betaallink aanmaken voor het openstaande bedrag van een factuur.
 * Gebruikt door de betaallink-knop op de factuurpagina én de factuur-e-mail.
 */

interface MolliePaymentResponse {
  id: string;
  _links: {
    checkout: { href: string };
  };
}

export type PaymentLinkResult =
  | { ok: true; paymentId: string; checkoutUrl: string }
  | { ok: false; error: string };

export async function createMolliePaymentLink(invoiceId: string): Promise<PaymentLinkResult> {
  const mollieKey = process.env.MOLLIE_API_KEY;
  if (!mollieKey) {
    return { ok: false, error: "MOLLIE_API_KEY niet ingesteld" };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: { select: { companyName: true } } },
  });
  if (!invoice) return { ok: false, error: "Factuur niet gevonden" };
  if (invoice.status === "PAID" || invoice.status === "CREDITED") {
    return { ok: false, error: "Factuur is al betaald" };
  }

  const openAmount = Number(invoice.openAmount);
  if (openAmount <= 0) return { ok: false, error: "Geen openstaand bedrag" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const body = {
    amount: {
      currency: "EUR",
      value: openAmount.toFixed(2),
    },
    description: `${invoice.invoiceNumber} – ${invoice.customer.companyName}`,
    redirectUrl: `${appUrl}/invoices/${invoiceId}/payments?mollie=success`,
    webhookUrl: `${appUrl}/api/mollie/webhook`,
    metadata: {
      invoiceId,
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
    return { ok: false, error: "Mollie betaling aanmaken mislukt" };
  }

  const payment = (await mollieRes.json()) as MolliePaymentResponse;

  // Mollie payment ID vastleggen als er nog geen eigen referentie is
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      ourReference: invoice.ourReference ? invoice.ourReference : `Mollie: ${payment.id}`,
    },
  });

  return { ok: true, paymentId: payment.id, checkoutUrl: payment._links.checkout.href };
}
