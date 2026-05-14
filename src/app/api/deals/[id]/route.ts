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

  const allowed = ["status", "winProbability", "notes", "expectedCloseDate", "title", "primaryContactId"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Geen geldige velden" }, { status: 400 });
  }

  try {
    const deal = await prisma.deal.update({ where: { id }, data });
    return NextResponse.json(deal);
  } catch {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { customer: true, primaryContact: true },
  });
  if (!deal) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  await prisma.deal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
