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
  const { status, quoteId, expectedDelivery, lineDeliveries, notes } = await req.json();

  const oc = await prisma.orderConfirmation.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(quoteId !== undefined && { quoteId: quoteId || null }),
      ...(expectedDelivery !== undefined && { expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null }),
      ...(lineDeliveries !== undefined && { lineDeliveries: lineDeliveries ?? {} }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(oc);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const oc = await prisma.orderConfirmation.findUnique({ where: { id }, select: { id: true } });
  if (!oc) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  // Gekoppelde verzenddocumenten loskoppelen (niet verwijderen)
  await prisma.deliveryNote.updateMany({ where: { confirmationId: id }, data: { confirmationId: null } });
  await prisma.orderConfirmation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const oc = await prisma.orderConfirmation.findUnique({
    where: { id },
    include: {
      deal: { select: { dealNumber: true, title: true } },
      quote: { select: { quoteNumber: true } },
      customer: { select: { companyName: true } },
    },
  });
  if (!oc) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  return NextResponse.json(oc);
}
