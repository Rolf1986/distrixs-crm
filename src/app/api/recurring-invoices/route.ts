import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const items = await prisma.recurringInvoice.findMany({
    include: {
      customer: { select: { companyName: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { nextRunDate: "asc" },
  });

  return NextResponse.json(
    items.map((r) => ({
      id: r.id,
      description: r.description,
      frequency: r.frequency,
      nextRunDate: r.nextRunDate.toISOString(),
      endDate: r.endDate?.toISOString() ?? null,
      isActive: r.isActive,
      customerId: r.customerId,
      customerName: r.customer.companyName,
      lineCount: r._count.lines,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await req.json();
  const { customerId, contactId, dealId, description, frequency, nextRunDate, endDate, paymentTermType, language, lines } = body;

  if (!customerId) return NextResponse.json({ error: "customerId verplicht" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "description verplicht" }, { status: 400 });
  if (!nextRunDate) return NextResponse.json({ error: "nextRunDate verplicht" }, { status: 400 });
  if (!lines || lines.length === 0) return NextResponse.json({ error: "Minimaal 1 regel verplicht" }, { status: 400 });

  const recurring = await prisma.recurringInvoice.create({
    data: {
      customerId,
      contactId: contactId ?? null,
      dealId: dealId ?? null,
      description,
      frequency: frequency ?? "MONTHLY",
      nextRunDate: new Date(nextRunDate),
      endDate: endDate ? new Date(endDate) : null,
      isActive: true,
      paymentTermType: paymentTermType ?? "DAYS_30",
      language: language ?? "NL",
      createdBy: session.user.id,
      lines: {
        create: (lines as Array<{
          skuSnapshot: string;
          titleSnapshot: string;
          qty: number;
          unitPrice: number;
          vatRate: number;
        }>).map((l, idx) => ({
          skuSnapshot: l.skuSnapshot,
          titleSnapshot: l.titleSnapshot,
          qty: l.qty,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate ?? 21,
          sortOrder: idx,
        })),
      },
    },
    include: { lines: true },
  });

  return NextResponse.json({ id: recurring.id }, { status: 201 });
}
