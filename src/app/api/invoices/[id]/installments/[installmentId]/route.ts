import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { installmentId } = await params;
  const body = await req.json() as {
    dueDate?: string;
    percentage?: number | null;
    amount?: number | null;
    isPaid?: boolean;
    notes?: string | null;
  };

  const updated = await prisma.invoiceInstallment.update({
    where: { id: installmentId },
    data: {
      dueDate:    body.dueDate    ? new Date(body.dueDate) : undefined,
      percentage: "percentage" in body ? (body.percentage ?? null) : undefined,
      amount:     "amount"     in body ? (body.amount ?? null)     : undefined,
      isPaid:     body.isPaid   !== undefined ? body.isPaid : undefined,
      notes:      "notes"      in body ? (body.notes ?? null)      : undefined,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { installmentId } = await params;
  await prisma.invoiceInstallment.delete({ where: { id: installmentId } });
  return NextResponse.json({ ok: true });
}
