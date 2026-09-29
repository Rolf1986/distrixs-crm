import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMolliePaymentLink } from "@/lib/mollie";

// Publieke, nooit-verlopende betaallink voor in facturen/herinneringen.
// Mollie-betalingen verlopen zelf na ±15 minuten; daarom maken we de
// betaling pas aan op het moment dat de klant klikt, en sturen we direct
// door naar de verse checkout. (Route is publiek — zie src/proxy.ts; het
// factuur-id is een onraadbaar cuid en stond voorheen ook al als
// checkout-link in de mail.)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.distrixs.nl";

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true, openAmount: true, invoiceNumber: true },
  });

  if (!invoice || invoice.status === "DRAFT") {
    return NextResponse.redirect(`${appUrl}/betaald?status=onbekend`);
  }
  if (Number(invoice.openAmount) <= 0 || invoice.status === "PAID" || invoice.status === "CREDITED") {
    // Al voldaan → gewoon de bedankpagina
    return NextResponse.redirect(`${appUrl}/betaald`);
  }

  const link = await createMolliePaymentLink(id);
  if (!link.ok) {
    console.error(`[pay] betaallink mislukt voor ${invoice.invoiceNumber}: ${link.error}`);
    return new NextResponse(
      "De betaalpagina kon niet worden geopend. Probeer het later opnieuw of neem contact op via info@distrixs.nl.",
      { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  return NextResponse.redirect(link.checkoutUrl);
}
