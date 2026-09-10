import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await req.json();
  const { product, qty, location, contactName, phone, email, notes } = body;
  if (!product?.trim()) {
    return NextResponse.json({ error: "Productnaam is verplicht" }, { status: 400 });
  }

  const loc = (location ?? "Kantoor").trim() || "Kantoor";
  const isOut = loc.toLowerCase() !== "kantoor";

  // Aantal N → N losse regels, zodat elk exemplaar apart uitgeleend kan worden
  const count = Math.min(50, Math.max(1, Number(qty) || 1));
  const data = {
    product: product.trim(),
    qty: 1,
    location: loc,
    contactName: contactName?.trim() || null,
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    notes: notes?.trim() || null,
    outSince: isOut ? new Date() : null,
  };
  const items = await prisma.$transaction(
    Array.from({ length: count }, () => prisma.demoItem.create({ data }))
  );

  return NextResponse.json(items, { status: 201 });
}
