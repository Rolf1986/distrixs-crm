import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fetchLabelPdf } from "@/lib/myparcel";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const shipments = await prisma.shipment.findMany({
    where: { deliveryNoteId: id, myParcelShipmentId: { not: null } },
    select: { myParcelShipmentId: true },
    orderBy: { createdAt: "asc" },
  });
  const ids = shipments.map((s) => s.myParcelShipmentId!).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ error: "Geen MyParcel-zending" }, { status: 404 });

  const pdf = await fetchLabelPdf(ids);
  if (!pdf) return NextResponse.json({ error: "Label kon niet worden opgehaald" }, { status: 502 });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="labels-${id}.pdf"`,
    },
  });
}
