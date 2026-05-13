import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: customerId } = await params;

  const pricelists = await prisma.customerPricelist.findMany({
    where: { customerId },
    include: {
      product: { select: { title: true, sku: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(pricelists);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: customerId } = await params;
  const body = await req.json();
  const { productId, fixedPrice, discountPct, validFrom, validUntil } = body;

  if (!productId) {
    return NextResponse.json({ error: "Product is verplicht" }, { status: 400 });
  }
  if (fixedPrice == null && discountPct == null) {
    return NextResponse.json(
      { error: "Vaste prijs of kortingspercentage is verplicht" },
      { status: 400 }
    );
  }

  // upsert so we can replace an existing entry for the same customer+product
  const entry = await prisma.customerPricelist.upsert({
    where: { customerId_productId: { customerId, productId } },
    update: {
      fixedPrice: fixedPrice != null ? Number(fixedPrice) : null,
      discountPct: discountPct != null ? Number(discountPct) : null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
    },
    create: {
      customerId,
      productId,
      fixedPrice: fixedPrice != null ? Number(fixedPrice) : null,
      discountPct: discountPct != null ? Number(discountPct) : null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
    },
    include: {
      product: { select: { title: true, sku: true } },
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
