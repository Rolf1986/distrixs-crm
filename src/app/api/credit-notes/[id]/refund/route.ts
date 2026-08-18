import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// Markeer een creditnota als terugbetaald aan de klant (POST) of maak die
// markering ongedaan (DELETE). Los van "verrekenen": terugbetalen is voor
// creditnota's op al betaalde facturen.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const cn = await prisma.creditNote.findUnique({ where: { id }, select: { creditNoteNumber: true } });
  if (!cn) return NextResponse.json({ error: "Creditnota niet gevonden" }, { status: 404 });

  await prisma.creditNote.update({ where: { id }, data: { refundedAt: new Date() } });
  await logAudit({
    userId: session.user.id,
    action: "credit_note.refunded",
    entityType: "CreditNote",
    entityId: id,
    newValue: `${cn.creditNoteNumber} gemarkeerd als terugbetaald`,
  });

  return NextResponse.json({ ok: true });
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
  await prisma.creditNote.update({ where: { id }, data: { refundedAt: null } });
  await logAudit({
    userId: session.user.id,
    action: "credit_note.refund_undone",
    entityType: "CreditNote",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
