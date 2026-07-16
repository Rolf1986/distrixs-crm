import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nextQuoteNumber } from "@/lib/sequences";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { customerId, dealId, validUntil } = await req.json();
  if (!customerId) return NextResponse.json({ error: "Klant verplicht" }, { status: 400 });

  const year = new Date().getFullYear();
  const quoteNumber = await nextQuoteNumber(year);

  // Taal volgt de klantkaart (NL/EN)
  const cust = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { defaultLanguage: true },
  });

  const quote = await prisma.quote.create({
    data: {
      quoteNumber,
      customerId,
      dealId: dealId || null,
      status: "DRAFT",
      quoteDate: new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      language: cust?.defaultLanguage === "EN" ? "EN" : "NL",
      subtotal: 0,
      vatAmount: 0,
      total: 0,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ id: quote.id, quoteNumber: quote.quoteNumber });
}
