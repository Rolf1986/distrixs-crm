import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const activities = await prisma.activity.findMany({
    where: { dealId: id },
    include: { createdByUser: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(activities);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { type = "NOTE", title, notes, dueAt } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Titel verplicht" }, { status: 400 });
  }

  const activity = await prisma.activity.create({
    data: {
      dealId: id,
      type,
      title: title.trim(),
      notes: notes?.trim() || null,
      dueAt: dueAt ? new Date(dueAt) : null,
      createdBy: session.user.id,
    },
    include: { createdByUser: { select: { name: true } } },
  });

  return NextResponse.json(activity, { status: 201 });
}
