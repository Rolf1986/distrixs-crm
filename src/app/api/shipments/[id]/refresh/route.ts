import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShipmentStatus } from "@/lib/myparcel";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/shipments/[id]/refresh — fetch fresh status from MyParcel and persist
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment)
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  if (!shipment.myParcelShipmentId) {
    return NextResponse.json(
      { error: "Geen MyParcel zending-ID gekoppeld" },
      { status: 400 }
    );
  }

  const result = await getShipmentStatus(shipment.myParcelShipmentId);
  if (!result) {
    return NextResponse.json(
      { error: "Kon status niet ophalen van MyParcel" },
      { status: 502 }
    );
  }

  const updated = await prisma.shipment.update({
    where: { id },
    data: {
      status: result.status,
      statusLabel: result.statusLabel,
      trackingCode: result.trackingCode ?? shipment.trackingCode,
      estimatedDelivery: result.estimatedDelivery,
      lastCheckedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
