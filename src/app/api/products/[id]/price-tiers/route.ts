import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const tiers = await prisma.productPriceTier.findMany({
    where: { productId: id },
    orderBy: { minQty: "asc" },
  });

  return NextResponse.json(
    tiers.map((t) => ({
      id: t.id,
      minQty: t.minQty,
      maxQty: t.maxQty,
      unitPrice: Number(t.unitPrice),
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const { minQty, maxQty, unitPrice } = await req.json();

  if (!minQty || minQty < 1 || unitPrice == null || unitPrice < 0) {
    return NextResponse.json(
      { error: "minQty en unitPrice zijn verplicht" },
      { status: 400 }
    );
  }

  const tier = await prisma.productPriceTier.create({
    data: {
      productId: id,
      minQty: Number(minQty),
      maxQty: maxQty != null ? Number(maxQty) : null,
      unitPrice: Number(unitPrice),
    },
  });

  return NextResponse.json(
    { id: tier.id, minQty: tier.minQty, maxQty: tier.maxQty, unitPrice: Number(tier.unitPrice) },
    { status: 201 }
  );
}
