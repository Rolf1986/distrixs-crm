import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createMolliePaymentLink } from "@/lib/mollie";

/**
 * Mollie betaallink genereren voor een factuur.
 *
 * Vereist MOLLIE_API_KEY in .env.local
 * Optioneel: NEXT_PUBLIC_APP_URL (standaard http://localhost:3000)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const result = await createMolliePaymentLink(id);

  if (!result.ok) {
    const status = result.error === "Factuur niet gevonden" ? 404
      : result.error === "MOLLIE_API_KEY niet ingesteld" ? 503
      : result.error === "Mollie betaling aanmaken mislukt" ? 502
      : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    paymentId: result.paymentId,
    checkoutUrl: result.checkoutUrl,
  });
}
