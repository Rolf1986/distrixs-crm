import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: customerId } = await params;

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  }

  const body = await req.json();
  const { firstName, lastName, email, phone, roleOrFunction } = body;

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: "Voor- en achternaam zijn verplicht" }, { status: 400 });
  }

  const contact = await prisma.customerContact.create({
    data: {
      customerId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      roleOrFunction: roleOrFunction?.trim() || null,
      isPrimary: false,
      isActive: true,
    },
  });

  return NextResponse.json(contact, { status: 201 });
}
