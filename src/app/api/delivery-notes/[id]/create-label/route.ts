import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createMyParcelShipments, getBarcode, normalizeCountry, MYPARCEL_CARRIERS } from "@/lib/myparcel";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const { carrier, numberOfPackages } = await req.json() as {
    carrier?: number;
    numberOfPackages?: number;
  };
  const carrierId = Number(carrier);
  if (!MYPARCEL_CARRIERS.some((c) => c.id === carrierId)) {
    return NextResponse.json({ error: "Ongeldige vervoerder" }, { status: 400 });
  }

  const dn = await prisma.deliveryNote.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
          contacts: { where: { isActive: true }, orderBy: { isPrimary: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!dn) return NextResponse.json({ error: "Verzenddocument niet gevonden" }, { status: 404 });

  // Verzendadres: SHIPPING, anders het standaard/eerste adres
  const addr =
    dn.customer.addresses.find((a) => a.type === "SHIPPING") ??
    dn.customer.addresses.find((a) => a.isDefault) ??
    dn.customer.addresses[0];
  if (!addr) {
    return NextResponse.json({ error: "Geen adres bij de klant — voeg eerst een adres toe" }, { status: 400 });
  }

  const contact = dn.customer.contacts[0];
  const person = contact ? `${contact.firstName} ${contact.lastName}`.trim() || dn.customer.companyName : dn.customer.companyName;
  const email = dn.customer.email ?? contact?.email ?? null;

  const { ids, error } = await createMyParcelShipments({
    recipient: {
      cc: normalizeCountry(addr.country),
      postal_code: addr.postalCode,
      city: addr.city,
      street: addr.street,
      number: addr.houseNumber || "",
      person,
      company: dn.customer.companyName,
      email,
    },
    carrier: carrierId,
    numberOfPackages: Number(numberOfPackages) || 1,
    reference: dn.deliveryNumber,
  });

  if (error || ids.length === 0) {
    return NextResponse.json({ error: error ?? "MyParcel gaf geen zending terug" }, { status: 502 });
  }

  const carrierLabel = MYPARCEL_CARRIERS.find((c) => c.id === carrierId)?.label ?? String(carrierId);

  // Zendingen opslaan + tracking ophalen (barcode kan even duren; best-effort)
  const created = [];
  for (const mpId of ids) {
    const barcode = await getBarcode(mpId).catch(() => null);
    const s = await prisma.shipment.create({
      data: {
        deliveryNoteId: id,
        customerId: dn.customerId,
        dealId: dn.dealId,
        myParcelShipmentId: String(mpId),
        trackingCode: barcode,
        carrier: carrierLabel,
        status: "PENDING",
        statusLabel: "Aangemeld",
      },
    });
    created.push({ id: s.id, myParcelShipmentId: String(mpId), trackingCode: barcode, carrier: carrierLabel });
  }

  // Eerste tracking + carrier ook op het verzenddocument zetten
  await prisma.deliveryNote.update({
    where: { id },
    data: { trackingCode: created[0]?.trackingCode ?? null, carrier: carrierLabel },
  }).catch(() => {});

  return NextResponse.json({ ok: true, shipments: created, labelIds: ids });
}
