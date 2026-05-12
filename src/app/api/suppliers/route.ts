import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, supplierType: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json();
  const { name, supplierType = "EU", defaultCurrency = "EUR", email, phone, notes } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Naam verplicht" }, { status: 400 });
  }

  const supplier = await prisma.supplier.create({
    data: {
      name: name.trim(),
      supplierType,
      defaultCurrency,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
    },
  });

  return NextResponse.json(supplier, { status: 201 });
}
