import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: supplierId, contactId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  const allowed = ["firstName", "lastName", "email", "phone", "roleOrFunction", "isPrimary", "isActive"];
  for (const f of allowed) {
    if (f in body) data[f] = typeof body[f] === "string" ? (body[f].trim() || null) : body[f];
  }

  if (body.isPrimary === true) {
    await prisma.supplierContact.updateMany({
      where: { supplierId, id: { not: contactId } },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.supplierContact.update({ where: { id: contactId }, data });
  return NextResponse.json(contact);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { contactId } = await params;
  await prisma.supplierContact.delete({ where: { id: contactId } });
  return NextResponse.json({ ok: true });
}
