import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { calcTotals, calcLineVat } from "@/lib/recalc";
import { assertInvoiceEditable } from "@/lib/document-guard";

function calcNetLineTotal(grossUnitPrice: number, qty: number, discountPercent: number) {
  return grossUnitPrice * qty * (1 - discountPercent / 100);
}

async function recalcInvoiceTotals(invoiceId: string) {
  const lines = await prisma.invoiceLine.findMany({ where: { invoiceId } });
  const { subtotal, vatAmount, total } = calcTotals(
    lines.map((l) => ({ netLineTotal: Number(l.netLineTotal), vatRate: Number(l.vatRate) }))
  );
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { paidAmount: true } });
  const openAmount = total - Number(invoice?.paidAmount ?? 0);
  await prisma.invoice.update({ where: { id: invoiceId }, data: { subtotal, vatAmount, total, openAmount } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: invoiceId } = await params;
  const guardError = await assertInvoiceEditable(invoiceId);
  if (guardError) return NextResponse.json({ error: guardError }, { status: 409 });

  const { productId, skuSnapshot, titleSnapshot, qty, grossUnitPrice, discountPercent, vatRate } = await req.json();

  // SKU is optioneel (bv. eenmalige regel) → "—"
  const sku = (skuSnapshot ?? "").trim() || "—";
  if (!titleSnapshot || !qty || grossUnitPrice === undefined) {
    return NextResponse.json({ error: "Omschrijving, aantal en prijs zijn verplicht" }, { status: 400 });
  }

  const discount = discountPercent ?? 0;
  const rate = vatRate !== undefined ? Number(vatRate) : 21;
  const netLineTotal = calcNetLineTotal(Number(grossUnitPrice), Number(qty), Number(discount));
  const lineVatAmount = calcLineVat(netLineTotal, rate);

  const line = await prisma.invoiceLine.create({
    data: {
      invoiceId,
      productId: productId || null,
      skuSnapshot: sku,
      titleSnapshot,
      qty: Number(qty),
      grossUnitPrice: Number(grossUnitPrice),
      discountPercent: Number(discount),
      netLineTotal,
      vatRate: rate,
      vatAmount: lineVatAmount,
    },
  });

  await recalcInvoiceTotals(invoiceId);
  return NextResponse.json(line);
}
