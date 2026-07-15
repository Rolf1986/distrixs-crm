import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const { text } = await req.json();
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Lege notitie" }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({ where: { id }, select: { id: true } });
  if (!quote) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  await logAudit({
    userId: session.user.id,
    action: "note.added",
    entityType: "Quote",
    entityId: id,
    newValue: text.trim(),
  });

  return NextResponse.json({ ok: true });
}
