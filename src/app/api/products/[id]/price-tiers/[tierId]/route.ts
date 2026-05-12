import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { tierId } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("minQty" in body) data.minQty = Number(body.minQty);
  if ("maxQty" in body) data.maxQty = body.maxQty != null ? Number(body.maxQty) : null;
  if ("unitPrice" in body) data.unitPrice = Number(body.unitPrice);

  const tier = await prisma.productPriceTier.update({ where: { id: tierId }, data });
  return NextResponse.json({
    id: tier.id,
    minQty: tier.minQty,
    maxQty: tier.maxQty,
    unitPrice: Number(tier.unitPrice),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { tierId } = await params;
  await prisma.productPriceTier.delete({ where: { id: tierId } });
  return NextResponse.json({ ok: true });
}
