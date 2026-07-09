import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { calcTotals } from "@/lib/recalc";

type RouteContext = { params: Promise<{ id: string }> };

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeDueDate(invoiceDate: Date, paymentTermType: string): Date {
  if (paymentTermType === "DAYS_14") return addDays(invoiceDate, 14);
  if (paymentTermType === "PREPAYMENT") return invoiceDate;
  return addDays(invoiceDate, 30); // DAYS_30, INSTALLMENTS, default
}

function computeNextRunDate(current: Date, frequency: string): Date {
  const d = new Date(current);
  switch (frequency) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession(req);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  const recurring = await prisma.recurringInvoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  if (!recurring) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  if (!recurring.isActive) return NextResponse.json({ error: "Terugkerende factuur is inactief" }, { status: 400 });

  const invoiceDate = new Date();
  const year = invoiceDate.getFullYear();
  // Concepten krijgen pas een definitief nummer bij het verzenden
  const invoiceNumber = `DRAFT-${crypto.randomUUID().slice(0, 8)}`;
  const dueDate = computeDueDate(invoiceDate, recurring.paymentTermType);

  // Calculate totals
  const linesForCalc = recurring.lines.map((l) => ({
    netLineTotal: Number(l.qty) * Number(l.unitPrice),
    vatRate: Number(l.vatRate),
  }));

  const { subtotal, vatAmount, total } = calcTotals(linesForCalc);

  // Create invoice in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: recurring.customerId,
        contactId: recurring.contactId,
        dealId: recurring.dealId,
        recurringInvoiceId: recurring.id,
        status: "DRAFT",
        invoiceDate,
        dueDate,
        paymentTermType: recurring.paymentTermType,
        subtotal,
        vatAmount,
        total,
        paidAmount: 0,
        openAmount: total,
        language: recurring.language,
        twinfieldSyncStatus: "NOT_SYNCED",
        twinfieldLocked: false,
        createdBy: userId,
        lines: {
          create: recurring.lines.map((l) => {
            const netLineTotal = Number(l.qty) * Number(l.unitPrice);
            return {
              skuSnapshot: l.skuSnapshot,
              titleSnapshot: l.titleSnapshot,
              qty: l.qty,
              grossUnitPrice: l.unitPrice,
              discountPercent: 0,
              netLineTotal,
              vatRate: l.vatRate,
              vatAmount: netLineTotal * (Number(l.vatRate) / 100),
            };
          }),
        },
      },
    });

    // Advance nextRunDate
    await tx.recurringInvoice.update({
      where: { id: recurring.id },
      data: {
        nextRunDate: computeNextRunDate(recurring.nextRunDate, recurring.frequency),
      },
    });

    return inv;
  });

  return NextResponse.json({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
}
