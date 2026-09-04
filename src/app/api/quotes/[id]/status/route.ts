import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const VALID_TRANSITIONS: Record<string, string[]> = {
  // Direct akkoord vanaf concept kan ook: offertes gaan niet altijd via het
  // systeem de deur uit
  DRAFT:    ["SENT", "ACCEPTED"],
  SENT:     ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: ["DRAFT"], // allow re-draft
};

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
  const newStatus: string = body.status;

  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) {
    return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  }

  const allowed = VALID_TRANSITIONS[quote.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Statusovergang ${quote.status} → ${newStatus} niet toegestaan` },
      { status: 422 }
    );
  }

  const updated = await prisma.quote.update({
    where: { id },
    data: { status: newStatus as never },
  });

  return NextResponse.json({ status: updated.status });
}
