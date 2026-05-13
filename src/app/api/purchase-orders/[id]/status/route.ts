import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ORDERED", "CANCELLED"],
  ORDERED: ["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED"],
  RECEIVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const { status: newStatus } = await req.json();

  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) {
    return NextResponse.json({ error: "Inkooporder niet gevonden" }, { status: 404 });
  }

  const allowed = VALID_TRANSITIONS[po.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Overgang van ${po.status} naar ${newStatus} is niet toegestaan.` },
      { status: 400 }
    );
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: newStatus },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
