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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: invoiceId, lineId } = await params;
  const guardError = await assertInvoiceEditable(invoiceId);
  if (guardError) return NextResponse.json({ error: guardError }, { status: 409 });

  const body = await req.json();

  const existing = await prisma.invoiceLine.findUnique({ where: { id: lineId } });
  if (!existing) return NextResponse.json({ error: "Regel niet gevonden" }, { status: 404 });

  const grossUnitPrice = body.grossUnitPrice !== undefined ? Number(body.grossUnitPrice) : Number(existing.grossUnitPrice);
  const qty = body.qty !== undefined ? Number(body.qty) : Number(existing.qty);
  const discountPercent = body.discountPercent !== undefined ? Number(body.discountPercent) : Number(existing.discountPercent);
  const vatRate = body.vatRate !== undefined ? Number(body.vatRate) : Number(existing.vatRate);
  const netLineTotal = calcNetLineTotal(grossUnitPrice, qty, discountPercent);
  const lineVatAmount = calcLineVat(netLineTotal, vatRate);

  const line = await prisma.invoiceLine.update({
    where: { id: lineId },
    data: {
      ...(body.titleSnapshot !== undefined && { titleSnapshot: body.titleSnapshot }),
      ...(body.skuSnapshot !== undefined && { skuSnapshot: body.skuSnapshot }),
      grossUnitPrice,
      qty,
      discountPercent,
      vatRate,
      netLineTotal,
      vatAmount: lineVatAmount,
    },
  });

  await recalcInvoiceTotals(invoiceId);
  return NextResponse.json(line);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id: invoiceId, lineId } = await params;
  const guardError = await assertInvoiceEditable(invoiceId);
  if (guardError) return NextResponse.json({ error: guardError }, { status: 409 });

  await prisma.invoiceLine.delete({ where: { id: lineId } });
  await recalcInvoiceTotals(invoiceId);
  return NextResponse.json({ success: true });
}
