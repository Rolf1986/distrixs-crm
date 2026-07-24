import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { customerId, dealId, paymentTerm, dueDate } = await req.json();
  if (!customerId) return NextResponse.json({ error: "Klant verplicht" }, { status: 400 });

  const year = new Date().getFullYear();
  // Concepten krijgen pas een definitief nummer bij het verzenden
  const invoiceNumber = `DRAFT-${crypto.randomUUID().slice(0, 8)}`;

  // Bereken vervaldatum op basis van betalingstermijn.
  // Zonder expliciete keuze: de standaardtermijn van de klant (klantkaart).
  // Taal + (bij ontbrekende keuze) termijn volgen de klantkaart
  const cust = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { defaultPaymentTerm: true, defaultLanguage: true },
  });
  const term = paymentTerm || cust?.defaultPaymentTerm || "DAYS_14";
  const language = cust?.defaultLanguage === "EN" ? "EN" : "NL";
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

  // Orderreferentie van de deal overnemen als startwaarde
  let dealOrderRef: string | null = null;
  if (dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { orderReference: true },
    });
    dealOrderRef = deal?.orderReference ?? null;
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId,
      dealId: dealId || null,
      ourReference: dealOrderRef,
      status: "DRAFT",
      invoiceDate,
      dueDate: computedDueDate,
      paymentTermType: term,
      language,
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
