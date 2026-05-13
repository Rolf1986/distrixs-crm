import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/shipments/[id] — single shipment
export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, companyName: true } },
      deal: { select: { id: true, dealNumber: true } },
      deliveryNote: { select: { id: true, deliveryNumber: true } },
    },
  });

  if (!shipment)
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  return NextResponse.json(shipment);
}

// PATCH /api/shipments/[id] — update tracking fields
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const { trackingCode, carrier, myParcelShipmentId } = body as {
    trackingCode?: string;
    carrier?: string;
    myParcelShipmentId?: string;
  };

  const updated = await prisma.shipment.update({
    where: { id },
    data: {
      ...(trackingCode !== undefined && { trackingCode }),
      ...(carrier !== undefined && { carrier }),
      ...(myParcelShipmentId !== undefined && { myParcelShipmentId }),
    },
  });

  return NextResponse.json(updated);
}
