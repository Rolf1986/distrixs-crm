import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
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
