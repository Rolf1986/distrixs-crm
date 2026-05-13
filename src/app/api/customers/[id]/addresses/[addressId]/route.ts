import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: customerId, addressId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  const allowed = ["type", "street", "houseNumber", "postalCode", "city", "country", "isDefault"];
  for (const f of allowed) {
    if (f in body) data[f] = body[f];
  }

  // If setting as default, unset others of same type
  if (body.isDefault === true) {
    const addr = await prisma.customerAddress.findUnique({ where: { id: addressId } });
    if (addr) {
      await prisma.customerAddress.updateMany({
        where: { customerId, type: body.type ?? addr.type, id: { not: addressId } },
        data: { isDefault: false },
      });
    }
  }

  const address = await prisma.customerAddress.update({ where: { id: addressId }, data });
  return NextResponse.json(address);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { addressId } = await params;
  await prisma.customerAddress.delete({ where: { id: addressId } });
  return NextResponse.json({ ok: true });
}
