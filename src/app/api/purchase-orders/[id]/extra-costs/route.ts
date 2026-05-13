import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: purchaseOrderId } = await params;
  const body = await req.json();
  const { costType, amount, currency = "EUR", description } = body;

  if (!costType || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Ongeldig type of bedrag" }, { status: 400 });
  }

  const cost = await prisma.purchaseOrderExtraCost.create({
    data: {
      purchaseOrderId,
      costType,
      amount: Number(amount),
      currency,
      description: description?.trim() || null,
    },
  });

  return NextResponse.json(cost, { status: 201 });
}
