import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { normalizeVatNumber } from "@/lib/vat";

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

  const data: Record<string, unknown> = {};
  const allowed = [
    "companyName", "kvkNumber", "vatNumber", "email",
    "status", "defaultPaymentTerm", "defaultLanguage",
    "notes",
  ];
  for (const f of allowed) {
    if (f in body) data[f] = body[f] === "" ? null : body[f];
    // Btw-nummer altijd genormaliseerd opslaan (geen puntjes/spaties)
    if (f === "vatNumber" && f in body) data[f] = normalizeVatNumber(body[f]);
  }
  // Taal moet NL of EN zijn
  if ("defaultLanguage" in data && data.defaultLanguage !== "EN") data.defaultLanguage = "NL";

  const customer = await prisma.customer.update({ where: { id }, data });
  return NextResponse.json(customer);
}
