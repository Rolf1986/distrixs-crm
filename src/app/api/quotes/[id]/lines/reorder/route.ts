import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Nieuwe volgorde van offerteregels opslaan (drag & drop in de regels-tabel).
// Body: { order: [lineId, lineId, …] } in de gewenste volgorde.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: quoteId } = await params;
  const body = await req.json().catch(() => ({}));
  const order: unknown = body.order;
  if (!Array.isArray(order) || order.some((x) => typeof x !== "string")) {
    return NextResponse.json({ error: "Ongeldige volgorde" }, { status: 400 });
  }

  const lines = await prisma.quoteLine.findMany({
    where: { quoteId },
    select: { id: true },
  });
  const known = new Set(lines.map((l) => l.id));
  const ids = (order as string[]).filter((lid) => known.has(lid));
  if (ids.length !== lines.length) {
    return NextResponse.json(
      { error: "Volgorde komt niet overeen met de regels van deze offerte" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    ids.map((lineId, idx) =>
      prisma.quoteLine.update({ where: { id: lineId }, data: { position: idx + 1 } })
    )
  );

  return NextResponse.json({ ok: true });
}
