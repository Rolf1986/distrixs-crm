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
  const { type, street, houseNumber, postalCode, city, country, isDefault } = body;
  if (!street?.trim() || !city?.trim()) {
    return NextResponse.json({ error: "Straat en plaats zijn verplicht" }, { status: 400 });
  }

  const addrType = ["BILLING", "SHIPPING", "VISITING"].includes(type) ? type : "VISITING";

  if (isDefault) {
    await prisma.supplierAddress.updateMany({
      where: { supplierId, type: addrType },
      data: { isDefault: false },
    });
  }

  const address = await prisma.supplierAddress.create({
    data: {
      supplierId,
      type: addrType,
      street: street.trim(),
      houseNumber: houseNumber?.trim() || "",
      postalCode: postalCode?.trim() || "",
      city: city.trim(),
      country: country?.trim() || "NL",
      isDefault: !!isDefault,
    },
  });

  return NextResponse.json(address, { status: 201 });
}
