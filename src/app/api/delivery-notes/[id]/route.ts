import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const { status, confirmationId, deliveryDate, carrier, trackingCode, notes } = await req.json();

  const dn = await prisma.deliveryNote.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(confirmationId !== undefined && { confirmationId: confirmationId || null }),
      ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
      ...(carrier !== undefined && { carrier }),
      ...(trackingCode !== undefined && { trackingCode }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(dn);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const dn = await prisma.deliveryNote.findUnique({
    where: { id },
    select: { id: true, _count: { select: { shipments: true } } },
  });
  if (!dn) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  if (dn._count.shipments > 0) {
    return NextResponse.json(
      { error: "Er hangen zendingen aan dit verzenddocument — koppel die eerst los" },
      { status: 409 }
    );
  }

  await prisma.deliveryNoteLine.deleteMany({ where: { deliveryNoteId: id } });
  await prisma.deliveryNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const dn = await prisma.deliveryNote.findUnique({
    where: { id },
    include: {
      deal: { select: { dealNumber: true, title: true } },
      customer: { select: { companyName: true } },
      confirmation: { select: { confirmationNumber: true } },
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!dn) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  return NextResponse.json(dn);
}
