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
  const body = await req.json();
  const { type, street, houseNumber, postalCode, city, country = "NL", isDefault = false } = body;

  if (!type || !street?.trim() || !houseNumber?.trim() || !postalCode?.trim() || !city?.trim()) {
    return NextResponse.json({ error: "Type, straat, huisnummer, postcode en stad zijn verplicht" }, { status: 400 });
  }

  // If this is default, unset others of same type
  if (isDefault) {
    await prisma.customerAddress.updateMany({
      where: { customerId, type },
      data: { isDefault: false },
    });
  }

  const address = await prisma.customerAddress.create({
    data: {
      customerId,
      type,
      street: street.trim(),
      houseNumber: houseNumber.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      country: country.trim() || "NL",
      isDefault,
    },
  });

  return NextResponse.json(address, { status: 201 });
}
