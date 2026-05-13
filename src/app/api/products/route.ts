import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const onlyActive = searchParams.get("active") === "1";

  const products = await prisma.product.findMany({
    where: onlyActive ? { isActive: true } : undefined,
    select: {
      id: true,
      sku: true,
      title: true,
      advisorySellPrice: true,
      baseCostPrice: true,
      unit: true,
      isActive: true,
    },
    orderBy: { title: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json();
  const { sku, title, supplierId, advisorySellPrice = 0, baseCostPrice = 0, unit = "stuk" } = body;

  if (!sku?.trim() || !title?.trim() || !supplierId) {
    return NextResponse.json({ error: "SKU, naam en leverancier zijn verplicht" }, { status: 400 });
  }

  // Check unique SKU
  const existing = await prisma.product.findUnique({ where: { sku: sku.trim() } });
  if (existing) {
    return NextResponse.json({ error: `SKU '${sku.trim()}' bestaat al` }, { status: 409 });
  }

  const product = await prisma.product.create({
    data: {
      sku: sku.trim(),
      title: title.trim(),
      supplierId,
      advisorySellPrice: Number(advisorySellPrice),
      baseCostPrice: Number(baseCostPrice),
      unit: unit.trim() || "stuk",
    },
    include: { supplier: { select: { name: true, supplierType: true } } },
  });

  return NextResponse.json(product, { status: 201 });
}
