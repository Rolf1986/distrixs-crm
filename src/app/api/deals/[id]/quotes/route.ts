import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextQuoteNumber } from "@/lib/sequences";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: dealId } = await params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, customerId: true, primaryContactId: true },
  });

  if (!deal) {
    return NextResponse.json({ error: "Deal niet gevonden" }, { status: 404 });
  }

  // Genereer volgend offertenummer voor dit jaar
  const year = new Date().getFullYear();
  const quoteNumber = await nextQuoteNumber(year);

  // Maak een lege concept-offerte aan — regels worden later toegevoegd via de offerteregels-pagina
  const quote = await prisma.quote.create({
    data: {
      quoteNumber,
      dealId: deal.id,
      customerId: deal.customerId,
      contactId: deal.primaryContactId,
      status: "DRAFT",
      quoteDate: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dagen geldig
      subtotal: 0,
      vatAmount: 0,
      total: 0,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ id: quote.id, quoteNumber: quote.quoteNumber });
}
