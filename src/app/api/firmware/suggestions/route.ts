import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { suggestRegistrationsFromInvoices } from "@/lib/firmwareSync";

export const dynamic = "force-dynamic";

/**
 * Voorstellen voor registraties op basis van factuurhistorie: welke klanten
 * hebben een product gekocht dat aan een ACME-firmwareproduct is gekoppeld?
 * Levert alleen voorstellen — aanvinken gebeurt via POST /api/firmware/registrations.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId") ?? undefined;

  const suggestions = await suggestRegistrationsFromInvoices(customerId);
  return NextResponse.json(suggestions);
}
