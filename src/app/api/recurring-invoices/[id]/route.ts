import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  const recurring = await prisma.recurringInvoice.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, companyName: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      deal: { select: { id: true, dealNumber: true, title: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!recurring) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  return NextResponse.json(recurring);
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ("description" in body) data.description = body.description;
  if ("frequency" in body) data.frequency = body.frequency;
  if ("nextRunDate" in body) data.nextRunDate = new Date(body.nextRunDate);
  if ("endDate" in body) data.endDate = body.endDate ? new Date(body.endDate) : null;
  if ("isActive" in body) data.isActive = Boolean(body.isActive);
  if ("paymentTermType" in body) data.paymentTermType = body.paymentTermType;
  if ("language" in body) data.language = body.language;

  // If lines are provided, replace all lines
  if ("lines" in body && Array.isArray(body.lines)) {
    await prisma.recurringInvoiceLine.deleteMany({ where: { recurringInvoiceId: id } });
    await prisma.recurringInvoiceLine.createMany({
      data: (body.lines as Array<{
        skuSnapshot: string;
        titleSnapshot: string;
        qty: number;
        unitPrice: number;
        vatRate: number;
      }>).map((l, idx) => ({
        recurringInvoiceId: id,
        skuSnapshot: l.skuSnapshot,
        titleSnapshot: l.titleSnapshot,
        qty: l.qty,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate ?? 21,
        sortOrder: idx,
      })),
    });
  }

  const updated = await prisma.recurringInvoice.update({
    where: { id },
    data,
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  // Soft delete: set isActive = false
  await prisma.recurringInvoice.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
