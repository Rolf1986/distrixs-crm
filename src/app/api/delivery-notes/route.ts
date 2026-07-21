import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nextDeliveryNoteNumber } from "@/lib/sequences";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { dealId, confirmationId, deliveryDate, carrier, trackingCode, notes } = await req.json();
  if (!dealId) return NextResponse.json({ error: "Deal verplicht" }, { status: 400 });

  // Get customer from deal
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { customerId: true } });
  if (!deal) return NextResponse.json({ error: "Deal niet gevonden" }, { status: 404 });

  // Artikelregels overnemen: uit de offerte van de gekoppelde orderbevestiging,
  // anders uit de recentste geaccepteerde/verzonden offerte van de deal
  let sourceQuoteId: string | null = null;
  if (confirmationId) {
    const oc = await prisma.orderConfirmation.findUnique({
      where: { id: confirmationId },
      select: { quoteId: true },
    });
    sourceQuoteId = oc?.quoteId ?? null;
  }
  if (!sourceQuoteId) {
    const quote =
      (await prisma.quote.findFirst({
        where: { dealId, status: "ACCEPTED" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })) ??
      (await prisma.quote.findFirst({
        where: { dealId, status: "SENT" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })) ??
      // Ook een concept-offerte is beter dan een leeg verzenddocument
      (await prisma.quote.findFirst({
        where: { dealId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }));
    sourceQuoteId = quote?.id ?? null;
  }
  let lines: Array<{ skuSnapshot: string; titleSnapshot: string; qty: unknown }> = sourceQuoteId
    ? await prisma.quoteLine.findMany({
        where: { quoteId: sourceQuoteId },
        select: { skuSnapshot: true, titleSnapshot: true, qty: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Laatste redmiddel: regels van de recentste factuur van de deal
  if (lines.length === 0) {
    const invoice = await prisma.invoice.findFirst({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (invoice) {
      lines = await prisma.invoiceLine.findMany({
        where: { invoiceId: invoice.id },
        select: { skuSnapshot: true, titleSnapshot: true, qty: true },
        orderBy: { createdAt: "asc" },
      });
    }
  }

  const year = new Date().getFullYear();
  const deliveryNumber = await nextDeliveryNoteNumber(year);

  const dn = await prisma.deliveryNote.create({
    data: {
      deliveryNumber,
      dealId,
      confirmationId: confirmationId || null,
      customerId: deal.customerId,
      status: "DRAFT",
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      carrier: carrier || null,
      trackingCode: trackingCode || null,
      notes: notes || null,
      createdBy: session.user.id,
      lines: {
        create: lines.map((l) => ({
          skuSnapshot: l.skuSnapshot,
          titleSnapshot: l.titleSnapshot,
          qty: l.qty as never,
        })),
      },
    },
  });

  return NextResponse.json({ id: dn.id, deliveryNumber: dn.deliveryNumber });
}
