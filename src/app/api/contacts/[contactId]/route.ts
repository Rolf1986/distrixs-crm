import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { contactId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  const allowed = ["firstName", "lastName", "email", "phone", "roleOrFunction", "isPrimary", "isActive"];
  for (const f of allowed) {
    if (f in body) data[f] = body[f] === "" ? null : body[f];
  }

  // If setting as primary, unset other primaries for this customer first
  if (body.isPrimary === true) {
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (contact) {
      await prisma.customerContact.updateMany({
        where: { customerId: contact.customerId, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }
  }

  const contact = await prisma.customerContact.update({ where: { id: contactId }, data });
  return NextResponse.json(contact);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { contactId } = await params;
  await prisma.customerContact.delete({ where: { id: contactId } });
  return NextResponse.json({ ok: true });
}
