import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nextInvoiceNumber } from "@/lib/sequences";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { customerId, dealId, paymentTerm, dueDate } = await req.json();
  if (!customerId) return NextResponse.json({ error: "Klant verplicht" }, { status: 400 });

  const year = new Date().getFullYear();
  const invoiceNumber = await nextInvoiceNumber(year);

  // Bereken vervaldatum op basis van betalingstermijn
  const term = paymentTerm || "DAYS_30";
  const invoiceDate = new Date();
  let computedDueDate: Date;
  if (dueDate) {
    computedDueDate = new Date(dueDate);
  } else {
    computedDueDate = new Date(invoiceDate);
    if      (term === "DAYS_14")      computedDueDate.setDate(computedDueDate.getDate() + 14);
    else if (term === "DAYS_30")      computedDueDate.setDate(computedDueDate.getDate() + 30);
    else if (term === "PREPAYMENT")   { /* dueDate = vandaag, geen aanpassing */ }
    else if (term === "INSTALLMENTS") computedDueDate.setDate(computedDueDate.getDate() + 30);
    else                              computedDueDate.setDate(computedDueDate.getDate() + 30);
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId,
      dealId: dealId || null,
      status: "DRAFT",
      invoiceDate,
      dueDate: computedDueDate,
      paymentTermType: term,
      subtotal: 0,
      vatAmount: 0,
      total: 0,
      paidAmount: 0,
      openAmount: 0,
      twinfieldSyncStatus: "NOT_SYNCED",
      twinfieldLocked: false,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ id: invoice.id, invoiceNumber: invoice.invoiceNumber });
}
