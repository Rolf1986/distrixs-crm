import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if ("status" in body) data.status = body.status;
  if ("title" in body) data.title = body.title;
  if ("dueAt" in body) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;

  // Als status op DONE gezet wordt én er een afrond-notitie meegegeven is:
  // voeg die toe aan bestaande notes (append), niet overschrijven
  if ("notes" in body && body.notes) {
    const existing = await prisma.activity.findUnique({
      where: { id },
      select: { notes: true },
    });
    const newNote = String(body.notes).trim();
    if (newNote) {
      data.notes = existing?.notes
        ? `${existing.notes}\n\n— Afgerond: ${newNote}`
        : newNote;
    }
  } else if ("notes" in body && body.notes === null) {
    // Expliciet null = wis de notes
    data.notes = null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Geen velden" }, { status: 400 });
  }

  const activity = await prisma.activity.update({
    where: { id },
    data,
    include: { createdByUser: { select: { name: true } } },
  });

  return NextResponse.json(activity);
}
