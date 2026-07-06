import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Zelfde bescherming als de hoofdroute: geen wijzigingen op betaalde/
// gecrediteerde of Twinfield-gelockte facturen.
async function assertInstallmentsEditable(invoiceId: string): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, twinfieldLocked: true },
  });
  if (!invoice) return "Factuur niet gevonden";
  if (invoice.twinfieldLocked) return "Factuur is vergrendeld na Twinfield-synchronisatie";
  if (invoice.status === "PAID" || invoice.status === "CREDITED") {
    return "Termijnen kunnen niet gewijzigd worden op een betaalde of gecrediteerde factuur";
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id, installmentId } = await params;
  const guardError = await assertInstallmentsEditable(id);
  if (guardError) return NextResponse.json({ error: guardError }, { status: 409 });

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

  const { id, installmentId } = await params;
  const guardError = await assertInstallmentsEditable(id);
  if (guardError) return NextResponse.json({ error: guardError }, { status: 409 });

  await prisma.invoiceInstallment.delete({ where: { id: installmentId } });
  return NextResponse.json({ ok: true });
}
