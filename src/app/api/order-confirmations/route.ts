import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextOrderConfirmationNumber } from "@/lib/sequences";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { dealId, quoteId, expectedDelivery, notes } = await req.json();
  if (!dealId) return NextResponse.json({ error: "Deal verplicht" }, { status: 400 });

  // Get customer from deal
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { customerId: true } });
  if (!deal) return NextResponse.json({ error: "Deal niet gevonden" }, { status: 404 });

  const year = new Date().getFullYear();
  const confirmationNumber = await nextOrderConfirmationNumber(year);

  const oc = await prisma.orderConfirmation.create({
    data: {
      confirmationNumber,
      dealId,
      quoteId: quoteId || null,
      customerId: deal.customerId,
      status: "DRAFT",
      confirmationDate: new Date(),
      expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
      notes: notes || null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ id: oc.id, confirmationNumber: oc.confirmationNumber });
}
