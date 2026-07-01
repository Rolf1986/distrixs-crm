import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Koppel (of ontkoppel) een webshop-account aan een CRM-klant/contactpersoon.
// Bewust handmatig te bevestigen — e-mailadressen van webshop en CRM kunnen verschillen.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { customerId?: string | null; contactId?: string | null };
  const customerId = body.customerId || null;
  const contactId = body.contactId || null;

  const account = await prisma.webshopAccount.findUnique({ where: { id }, select: { id: true } });
  if (!account) return NextResponse.json({ error: "Account niet gevonden" }, { status: 404 });

  // Ontkoppelen
  if (!customerId) {
    await prisma.webshopAccount.update({
      where: { id },
      data: { customerId: null, contactId: null, linkStatus: "UNLINKED" },
    });
    return NextResponse.json({ ok: true, linkStatus: "UNLINKED" });
  }

  // Valideer klant + (optioneel) dat de contactpersoon bij die klant hoort
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  if (contactId) {
    const contact = await prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contactpersoon hoort niet bij deze klant" }, { status: 400 });
    }
  }

  await prisma.webshopAccount.update({
    where: { id },
    data: { customerId, contactId, linkStatus: "CONFIRMED" },
  });
  return NextResponse.json({ ok: true, linkStatus: "CONFIRMED" });
}
