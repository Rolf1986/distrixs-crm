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

  const data: Record<string, unknown> = {};
  const fields = ["sku", "title", "supplierId", "advisorySellPrice", "baseCostPrice", "unit", "isActive", "shortDescription"];
  for (const f of fields) {
    if (f in body) data[f] = body[f];
  }

  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json(product);
}
