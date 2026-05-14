import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ("validUntil" in body) {
    data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
  }
  if ("language" in body && ["NL", "EN"].includes(body.language)) {
    data.language = body.language;
  }

  const quote = await prisma.quote.update({ where: { id }, data });
  return NextResponse.json(quote);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true } } },
  });
  if (!quote) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  if (quote._count.invoices > 0) {
    return NextResponse.json({ error: "Offerte heeft facturen en kan niet worden verwijderd" }, { status: 400 });
  }

  if (quote.status !== "DRAFT" && quote.status !== "REJECTED") {
    return NextResponse.json({ error: "Alleen concept- of afgewezen offertes kunnen worden verwijderd" }, { status: 400 });
  }

  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
