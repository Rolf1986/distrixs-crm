import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: supplierId } = await params;
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return NextResponse.json({ error: "Leverancier niet gevonden" }, { status: 404 });

  const body = await req.json();
  const { firstName, lastName, email, phone, roleOrFunction, isPrimary } = body;
  if (!firstName?.trim() && !lastName?.trim()) {
    return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
  }

  if (isPrimary) {
    await prisma.supplierContact.updateMany({ where: { supplierId }, data: { isPrimary: false } });
  }

  const contact = await prisma.supplierContact.create({
    data: {
      supplierId,
      firstName: firstName?.trim() || "",
      lastName: lastName?.trim() || "",
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      roleOrFunction: roleOrFunction?.trim() || null,
      isPrimary: !!isPrimary,
      isActive: true,
    },
  });

  return NextResponse.json(contact, { status: 201 });
}
