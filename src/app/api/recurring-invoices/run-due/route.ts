import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nextInvoiceNumber } from "@/lib/sequences";
import { calcTotals } from "@/lib/recalc";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeDueDate(invoiceDate: Date, paymentTermType: string): Date {
  if (paymentTermType === "DAYS_14") return addDays(invoiceDate, 14);
  if (paymentTermType === "PREPAYMENT") return invoiceDate;
  return addDays(invoiceDate, 30);
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

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const today = new Date();
  today.setHours(23, 59, 59, 999); // include all of today

  // Find all due active recurring invoices not past endDate
  const dueItems = await prisma.recurringInvoice.findMany({
    where: {
      isActive: true,
      nextRunDate: { lte: today },
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } },
      ],
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  const invoiceNumbers: string[] = [];
  const invoiceDate = new Date();

  for (const recurring of dueItems) {
    const year = invoiceDate.getFullYear();
    const invoiceNumber = await nextInvoiceNumber(year);
    const dueDate = computeDueDate(invoiceDate, recurring.paymentTermType);

    const linesForCalc = recurring.lines.map((l) => ({
      netLineTotal: Number(l.qty) * Number(l.unitPrice),
      vatRate: Number(l.vatRate),
    }));

    const { subtotal, vatAmount, total } = calcTotals(linesForCalc);

    await prisma.$transaction(async (tx) => {
      await tx.invoice.create({
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

      await tx.recurringInvoice.update({
        where: { id: recurring.id },
        data: {
          nextRunDate: computeNextRunDate(recurring.nextRunDate, recurring.frequency),
        },
      });
    });

    invoiceNumbers.push(invoiceNumber);
  }

  return NextResponse.json({ generated: invoiceNumbers.length, invoiceNumbers });
}
