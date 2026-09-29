import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

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
  // Geef de duurzame /pay/-link terug (maakt pas bij de klik een verse
  // Mollie-checkout aan). Directe checkout-links verlopen na ±15 minuten —
  // een gekopieerde link was daardoor vrijwel altijd dood bij de klant.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.distrixs.nl";
  return NextResponse.json({ checkoutUrl: `${appUrl}/pay/${id}` });
}
