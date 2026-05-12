import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextCreditNoteNumber } from "@/lib/sequences";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
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

  const year = new Date().getFullYear();
  const creditNoteNumber = await nextCreditNoteNumber(year);

  // Build lines: copy from invoice lines, negate netLineTotal (and vatAmount).
  // qty stays positive; lineTotal is negative to represent a credit.
  const creditLines = invoice.lines.map((l) => {
    const netLineTotal = -Math.abs(Number(l.netLineTotal));
    const vatAmount = -Math.abs(Number(l.vatAmount));
    return {
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      qty: Number(l.qty),
      unitPrice: Number(l.grossUnitPrice),
      vatRate: Number(l.vatRate),
      lineTotal: netLineTotal,
      vatAmount,
    };
  });

  const subtotal = creditLines.reduce((s, l) => s + l.lineTotal, 0);
  const vatAmount = creditLines.reduce((s, l) => s + l.vatAmount, 0);
  const total = subtotal + vatAmount;

  const creditNote = await prisma.$transaction(async (tx) => {
    const cn = await tx.creditNote.create({
      data: {
        creditNoteNumber,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        subtotal,
        vatAmount,
        total,
        language: invoice.language,
        createdBy: session.user!.id as string,
        lines: {
          create: creditLines,
        },
      },
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "CREDITED" },
    });

    return cn;
  });

  return NextResponse.json({ id: creditNote.id, creditNoteNumber: creditNote.creditNoteNumber });
}
