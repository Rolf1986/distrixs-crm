import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getShipmentStatus } from "@/lib/myparcel";

// POST /api/shipments/refresh-all — refresh status of all non-delivered shipments
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  // Fetch all shipments that are not yet delivered or cancelled
  const pending = await prisma.shipment.findMany({
    where: {
      status: { notIn: ["DELIVERED", "CANCELLED"] },
      myParcelShipmentId: { not: null },
    },
  });

  let updated = 0;

  for (const shipment of pending) {
    if (!shipment.myParcelShipmentId) continue;

    const result = await getShipmentStatus(shipment.myParcelShipmentId);
    if (!result) continue;

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: result.status,
        statusLabel: result.statusLabel,
        trackingCode: result.trackingCode ?? shipment.trackingCode,
        estimatedDelivery: result.estimatedDelivery,
        lastCheckedAt: new Date(),
      },
    });

    updated++;
  }

  return NextResponse.json({ updated });
}
