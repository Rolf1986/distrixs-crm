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
  const existing = await prisma.demoItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Item niet gevonden" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.product !== undefined) data.product = String(body.product).trim();
  if (body.qty !== undefined) data.qty = Math.max(1, Number(body.qty) || 1);
  if (body.contactName !== undefined) data.contactName = body.contactName?.trim() || null;
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.email !== undefined) data.email = body.email?.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

  if (body.location !== undefined) {
    const loc = String(body.location).trim() || "Kantoor";
    data.location = loc;
    const wasOut = existing.location.toLowerCase() !== "kantoor";
    const isOut = loc.toLowerCase() !== "kantoor";
    // Uitgeven → klok start; retour → klok en contactgegevens leeg
    if (isOut && !wasOut) data.outSince = new Date();
    if (!isOut) {
      data.outSince = null;
      if (body.contactName === undefined) data.contactName = null;
      if (body.phone === undefined) data.phone = null;
      if (body.email === undefined) data.email = null;
    }
  }

  const item = await prisma.demoItem.update({ where: { id }, data });
  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  await prisma.demoItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
