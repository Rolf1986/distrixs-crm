import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

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

  const allowed = ["status", "winProbability", "notes", "expectedCloseDate", "title", "primaryContactId", "orderReference"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  // Klant wijzigen: concept-documenten van de deal verhuizen mee, verzonden/
  // definitieve documenten blijven (immutable) bij de oude klant staan.
  if (typeof body.customerId === "string" && body.customerId) {
    const [customer, deal] = await Promise.all([
      prisma.customer.findUnique({ where: { id: body.customerId }, select: { id: true } }),
      prisma.deal.findUnique({ where: { id }, select: { customerId: true } }),
    ]);
    if (!deal) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    if (!customer) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 400 });

    if (deal.customerId !== body.customerId) {
      // Oude contactpersoon hoort bij de oude klant → loskoppelen
      data.customerId = body.customerId;
      data.primaryContactId = null;
      const [, quotes, invoices, deliveryNotes, orderConfirmations] = await prisma.$transaction([
        prisma.deal.update({ where: { id }, data }),
        prisma.quote.updateMany({
          where: { dealId: id, status: "DRAFT" },
          data: { customerId: body.customerId, contactId: null },
        }),
        prisma.invoice.updateMany({
          where: { dealId: id, status: "DRAFT" },
          data: { customerId: body.customerId, contactId: null },
        }),
        prisma.deliveryNote.updateMany({
          where: { dealId: id, status: "DRAFT" },
          data: { customerId: body.customerId, contactId: null },
        }),
        prisma.orderConfirmation.updateMany({
          where: { dealId: id, status: "DRAFT" },
          data: { customerId: body.customerId },
        }),
      ]);
      return NextResponse.json({
        ok: true,
        moved: {
          quotes: quotes.count,
          invoices: invoices.count,
          deliveryNotes: deliveryNotes.count,
          orderConfirmations: orderConfirmations.count,
        },
      });
    }
    // Zelfde klant gekozen: alleen eventuele overige velden bijwerken
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Geen geldige velden" }, { status: 400 });
  }

  try {
    const deal = await prisma.deal.update({ where: { id }, data });

    // Nieuwe contactpersoon op de deal → ook op de concept-documenten zetten
    // (alleen als het contact bij de klant van dat document hoort; verzonden
    // documenten blijven onaangeroerd)
    if (typeof data.primaryContactId === "string" && data.primaryContactId) {
      const contact = await prisma.customerContact.findUnique({
        where: { id: data.primaryContactId },
        select: { customerId: true },
      });
      if (contact) {
        await prisma.$transaction([
          prisma.quote.updateMany({
            where: { dealId: id, status: "DRAFT", customerId: contact.customerId },
            data: { contactId: data.primaryContactId },
          }),
          prisma.invoice.updateMany({
            where: { dealId: id, status: "DRAFT", customerId: contact.customerId },
            data: { contactId: data.primaryContactId },
          }),
          prisma.deliveryNote.updateMany({
            where: { dealId: id, status: "DRAFT", customerId: contact.customerId },
            data: { contactId: data.primaryContactId },
          }),
        ]);
      }
    }

    return NextResponse.json(deal);
  } catch {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { customer: true, primaryContact: true },
  });
  if (!deal) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      _count: { select: { invoices: true } },
      purchaseOrders: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
    },
  });
  if (!deal) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  // Bescherming: geen deal wissen waar al facturen of geplaatste inkooporders aan hangen
  if (deal._count.invoices > 0) {
    return NextResponse.json(
      { error: "Deal heeft facturen en kan niet worden verwijderd" },
      { status: 409 }
    );
  }
  if (deal.purchaseOrders.length > 0) {
    return NextResponse.json(
      { error: "Deal heeft geplaatste inkooporders en kan niet worden verwijderd" },
      { status: 409 }
    );
  }

  try {
    // Verwijder eerst records met verplichte dealId (geen cascade in schema)
    // DeliveryNotes (lines hebben cascade op deliveryNoteId)
    await prisma.deliveryNote.deleteMany({ where: { dealId: id } });
    // OrderConfirmations
    await prisma.orderConfirmation.deleteMany({ where: { dealId: id } });
    // Deal zelf (DealLines hebben cascade)
    await prisma.deal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[deal delete]", err);
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}
