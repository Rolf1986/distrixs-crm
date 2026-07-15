import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: supplierId, addressId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  const allowed = ["type", "street", "houseNumber", "postalCode", "city", "country", "isDefault"];
  for (const f of allowed) {
    if (f in body) data[f] = body[f];
  }

  if (body.isDefault === true) {
    const addr = await prisma.supplierAddress.findUnique({ where: { id: addressId } });
    if (addr) {
      await prisma.supplierAddress.updateMany({
        where: { supplierId, type: body.type ?? addr.type, id: { not: addressId } },
        data: { isDefault: false },
      });
    }
  }

  const address = await prisma.supplierAddress.update({ where: { id: addressId }, data });
  return NextResponse.json(address);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { addressId } = await params;
  await prisma.supplierAddress.delete({ where: { id: addressId } });
  return NextResponse.json({ ok: true });
}
