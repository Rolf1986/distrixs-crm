import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const TERM_DAYS: Record<string, number> = {
  DAYS_14: 14,
  DAYS_30: 30,
  PREPAYMENT: 0,
  INSTALLMENTS: 30,
};

// Kopieer een factuur naar een nieuw concept (met alle regels).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const src = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!src) return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });

  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + (TERM_DAYS[src.paymentTermType] ?? 14));

  const copy = await prisma.invoice.create({
    data: {
      invoiceNumber: `DRAFT-${crypto.randomUUID().slice(0, 8)}`,
      customerId: src.customerId,
      dealId: src.dealId,
      contactId: src.contactId,
      quoteId: null, // kopie staat los van de oorspronkelijke offerte
      status: "DRAFT",
      invoiceDate,
      dueDate,
      paymentTermType: src.paymentTermType,
      language: src.language,
      ourReference: src.ourReference,
      subtotal: src.subtotal,
      vatAmount: src.vatAmount,
      total: src.total,
      paidAmount: 0,
      openAmount: src.total,
      twinfieldSyncStatus: "NOT_SYNCED",
      twinfieldLocked: false,
      createdBy: session.user.id,
      lines: {
        create: src.lines.map((l) => ({
          productId: l.productId,
          skuSnapshot: l.skuSnapshot,
          titleSnapshot: l.titleSnapshot,
          qty: l.qty,
          grossUnitPrice: l.grossUnitPrice,
          discountPercent: l.discountPercent,
          netLineTotal: l.netLineTotal,
          vatRate: l.vatRate,
          vatAmount: l.vatAmount,
        })),
      },
    },
  });

  return NextResponse.json({ id: copy.id, invoiceNumber: copy.invoiceNumber });
}
