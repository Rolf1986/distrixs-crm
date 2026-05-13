import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nextInvoiceNumber } from "@/lib/sequences";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: quoteId } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      lines: true,
      customer: { select: { defaultPaymentTerm: true } },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  }

  if (quote.status !== "ACCEPTED") {
    return NextResponse.json(
      { error: "Factuur kan alleen worden aangemaakt voor een geaccepteerde offerte." },
      { status: 400 }
    );
  }

  // Generate sequential invoice number for this year
  const year = new Date().getFullYear();
  const invoiceNumber = await nextInvoiceNumber(year);

  const invoiceDate = new Date();
  const paymentTerm = quote.customer?.defaultPaymentTerm ?? "DAYS_30";
  const dueDate = new Date(invoiceDate);
  if      (paymentTerm === "DAYS_14")      dueDate.setDate(dueDate.getDate() + 14);
  else if (paymentTerm === "PREPAYMENT")   { /* dueDate = vandaag */ }
  else if (paymentTerm === "INSTALLMENTS") dueDate.setDate(dueDate.getDate() + 30);
  else                                     dueDate.setDate(dueDate.getDate() + 30);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      dealId: quote.dealId,
      quoteId: quote.id,
      customerId: quote.customerId,
      contactId: quote.contactId,
      status: "DRAFT",
      invoiceDate,
      dueDate,
      paymentTermType: paymentTerm,
      subtotal: quote.subtotal,
      vatAmount: quote.vatAmount,
      total: quote.total,
      paidAmount: 0,
      openAmount: quote.total,
      createdBy: session.user.id,
      lines: {
        create: quote.lines.map((l) => ({
          quoteLineId: l.id,
          skuSnapshot: l.skuSnapshot,
          titleSnapshot: l.titleSnapshot,
          qty: l.qty,
          grossUnitPrice: l.grossUnitPrice,
          discountPercent: l.discountPercent,
          netLineTotal: l.netLineTotal,
        })),
      },
    },
  });

  return NextResponse.json({ id: invoice.id, invoiceNumber: invoice.invoiceNumber });
}
