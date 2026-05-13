import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/shipments — list all shipments with related data
export async function GET() {
  const session = await getSession(null);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, companyName: true } },
      deal: { select: { id: true, dealNumber: true } },
      deliveryNote: { select: { id: true, deliveryNumber: true } },
    },
  });

  return NextResponse.json(
    shipments.map((s) => ({
      id: s.id,
      myParcelShipmentId: s.myParcelShipmentId,
      trackingCode: s.trackingCode,
      carrier: s.carrier,
      status: s.status,
      statusLabel: s.statusLabel,
      lastCheckedAt: s.lastCheckedAt,
      estimatedDelivery: s.estimatedDelivery,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      customerId: s.customerId,
      customerName: s.customer?.companyName ?? null,
      dealId: s.dealId,
      dealNumber: s.deal?.dealNumber ?? null,
      deliveryNoteId: s.deliveryNoteId,
      deliveryNumber: s.deliveryNote?.deliveryNumber ?? null,
    }))
  );
}

// POST /api/shipments — create a new shipment
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await req.json();
  const { deliveryNoteId, customerId, dealId, myParcelShipmentId, trackingCode, carrier } =
    body as {
      deliveryNoteId?: string;
      customerId?: string;
      dealId?: string;
      myParcelShipmentId?: string;
      trackingCode?: string;
      carrier?: string;
    };

  const shipment = await prisma.shipment.create({
    data: {
      deliveryNoteId: deliveryNoteId || null,
      customerId: customerId || null,
      dealId: dealId || null,
      myParcelShipmentId: myParcelShipmentId || null,
      trackingCode: trackingCode || null,
      carrier: carrier || null,
      status: "PENDING",
    },
    include: {
      customer: { select: { id: true, companyName: true } },
      deal: { select: { id: true, dealNumber: true } },
      deliveryNote: { select: { id: true, deliveryNumber: true } },
    },
  });

  return NextResponse.json(
    {
      id: shipment.id,
      trackingCode: shipment.trackingCode,
      status: shipment.status,
    },
    { status: 201 }
  );
}
