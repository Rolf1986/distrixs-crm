import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nextCreditNoteNumber } from "@/lib/sequences";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(null);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }

  const CREDITABLE = ["SENT", "PARTIALLY_PAID", "OVERDUE"] as const;
  if (!CREDITABLE.includes(invoice.status as (typeof CREDITABLE)[number])) {
    return NextResponse.json(
      { error: `Factuur met status ${invoice.status} kan niet gecrediteerd worden` },
      { status: 422 }
    );
  }

  // Selectie uit de body: welke regels + welk aantal. Zonder body → alles volledig.
  let body: { reason?: string | null; lines?: Array<{ lineId: string; qty: number }> } = {};
  try { body = await req.json(); } catch { /* geen body → alles crediteren */ }
  const selection = Array.isArray(body.lines) ? body.lines : null;

  // Bepaal per factuurregel het te crediteren aantal
  const toCredit = invoice.lines
    .map((l) => {
      const fullQty = Number(l.qty);
      let creditQty = fullQty;
      if (selection) {
        const sel = selection.find((s) => s.lineId === l.id);
        creditQty = sel ? Math.max(0, Math.min(Number(sel.qty), fullQty)) : 0;
      }
      return { line: l, creditQty, fullQty };
    })
    .filter((x) => x.creditQty > 0);

  if (toCredit.length === 0) {
    return NextResponse.json({ error: "Geen regels geselecteerd om te crediteren" }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const creditNoteNumber = await nextCreditNoteNumber(year);

  // Regels: negatief; bij deel-aantal proportioneel op basis van het regeltotaal.
  const creditLines = toCredit.map(({ line, creditQty, fullQty }) => {
    const ratio = fullQty > 0 ? creditQty / fullQty : 1;
    const netLineTotal = -Math.abs(Number(line.netLineTotal)) * ratio;
    const vatAmount = -Math.abs(Number(line.netLineTotal)) * ratio * (Number(line.vatRate) / 100);
    return {
      skuSnapshot: line.skuSnapshot,
      titleSnapshot: line.titleSnapshot,
      qty: creditQty,
      unitPrice: Number(line.grossUnitPrice),
      vatRate: Number(line.vatRate),
      lineTotal: Math.round(netLineTotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
    };
  });

  const subtotal = Math.round(creditLines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const vatAmount = Math.round(creditLines.reduce((s, l) => s + l.vatAmount, 0) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  // Factuur alleen volledig op CREDITED zetten als (nagenoeg) het hele bedrag
  // gecrediteerd is. Bij een deelcreditering blijft de factuurstatus staan.
  const fullyCredited = Math.abs(total) >= Number(invoice.total) - 0.01;

  const creditNote = await prisma.$transaction(async (tx) => {
    const cn = await tx.creditNote.create({
      data: {
        creditNoteNumber,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        reason: body.reason?.trim() || null,
        subtotal,
        vatAmount,
        total,
        language: invoice.language,
        createdBy: session.user!.id as string,
        lines: { create: creditLines },
      },
    });

    if (fullyCredited) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "CREDITED" },
      });
    }

    return cn;
  });

  return NextResponse.json({ id: creditNote.id, creditNoteNumber: creditNote.creditNoteNumber });
}
