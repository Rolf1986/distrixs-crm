import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json();
  const { type = "NOTE", title, notes, dueAt, dealId, customerId } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Titel verplicht" }, { status: 400 });
  }

  const activity = await prisma.activity.create({
    data: {
      type,
      title: title.trim(),
      notes: notes?.trim() || null,
      dueAt: dueAt ? new Date(dueAt) : null,
      dealId: dealId || null,
      customerId: customerId || null,
      createdBy: session.user.id,
    },
    include: {
      createdByUser: { select: { name: true } },
      deal: { select: { id: true, dealNumber: true, title: true } },
    },
  });

  return NextResponse.json(activity, { status: 201 });
}
