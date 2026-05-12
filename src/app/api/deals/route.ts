import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextDealNumber } from "@/lib/sequences";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { title, customerId, notes, expectedCloseDate } = await req.json();
  if (!title || !customerId) {
    return NextResponse.json({ error: "Titel en klant zijn verplicht" }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const dealNumber = await nextDealNumber(year);

  const deal = await prisma.deal.create({
    data: {
      dealNumber,
      title,
      customerId,
      status: "NEW",
      notes: notes || null,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ id: deal.id, dealNumber: deal.dealNumber });
}
