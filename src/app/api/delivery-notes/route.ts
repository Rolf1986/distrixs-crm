import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nextDeliveryNoteNumber } from "@/lib/sequences";
import { resolveDeliveryLines } from "@/lib/delivery-lines";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { dealId, contactId, confirmationId, deliveryDate, carrier, trackingCode, notes, lines: selectedLines } = await req.json();
  if (!dealId) return NextResponse.json({ error: "Deal verplicht" }, { status: 400 });

  // Get customer from deal
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { customerId: true, primaryContactId: true } });
  if (!deal) return NextResponse.json({ error: "Deal niet gevonden" }, { status: 404 });

  const resolved = await resolveDeliveryLines(dealId, confirmationId);
  const language = resolved.language;

  // Regelselectie uit het aanmaakvenster (deelzending): alleen de aangevinkte
  // regels met het opgegeven aantal. Zonder selectie → alle regels van de bron.
  let lines = resolved.lines;
  if (Array.isArray(selectedLines)) {
    lines = selectedLines
      .map((l: { skuSnapshot?: unknown; titleSnapshot?: unknown; qty?: unknown }) => ({
        skuSnapshot: String(l.skuSnapshot ?? ""),
        titleSnapshot: String(l.titleSnapshot ?? "").trim(),
        qty: Math.max(0, Number(l.qty) || 0),
      }))
      .filter((l) => l.titleSnapshot && l.qty > 0);
    if (lines.length === 0) {
      return NextResponse.json({ error: "Selecteer minstens één regel met een aantal" }, { status: 400 });
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
      // Contactpersoon: expliciet gekozen, anders de contactpersoon van de deal
      contactId: contactId || deal.primaryContactId || null,
      status: "DRAFT",
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      carrier: carrier || null,
      trackingCode: trackingCode || null,
      notes: notes || null,
      language,
      createdBy: session.user.id,
      lines: {
        create: lines.map((l) => ({
          skuSnapshot: l.skuSnapshot,
          titleSnapshot: l.titleSnapshot,
          qty: l.qty,
        })),
      },
    },
  });

  return NextResponse.json({ id: dn.id, deliveryNumber: dn.deliveryNumber });
}

// Kandidaat-regels voor het aanmaakvenster: wat zou er op het verzenddocument
// komen voor deze deal/orderbevestiging? (voor de regelselectie bij deelzendingen)
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const dealId = req.nextUrl.searchParams.get("dealId");
  const confirmationId = req.nextUrl.searchParams.get("confirmationId");
  if (!dealId) return NextResponse.json({ error: "dealId verplicht" }, { status: 400 });

  const resolved = await resolveDeliveryLines(dealId, confirmationId || null);
  return NextResponse.json(resolved.lines);
}
