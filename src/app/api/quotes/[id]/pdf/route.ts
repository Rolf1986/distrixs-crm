import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { QuotePdf } from "@/components/pdf/QuotePdf";
import { getCompanyInfo } from "@/lib/companySettings";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: {
        include: { addresses: { where: { type: "BILLING", isDefault: true }, take: 1 } },
      },
      contact: true,
      deal: { select: { title: true } },
      lines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const company = await getCompanyInfo();
  const addr = quote.customer.addresses[0];

  const data = {
    language: quote.language ?? "NL",
    quoteNumber: quote.quoteNumber,
    projectName: quote.deal?.title,
    quoteDate: quote.quoteDate,
    validUntil: quote.validUntil,
    subtotal: Number(quote.subtotal),
    vatAmount: Number(quote.vatAmount),
    total: Number(quote.total),
    company,
    customer: {
      companyName: quote.customer.companyName,
      contactName: quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName}` : null,
      email: quote.contact?.email ?? null,
      address: addr ? `${addr.street} ${addr.houseNumber}` : null,
      postalCode: addr?.postalCode ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
    },
    lines: quote.lines.map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      descriptionSnapshot: null,
      qty: Number(l.qty),
      grossUnitPrice: Number(l.grossUnitPrice),
      discountPercent: Number(l.discountPercent),
      netLineTotal: Number(l.netLineTotal),
    })),
  };

  try {
    const element = createElement(QuotePdf, { data });
    const buffer = await renderToBuffer(element as never);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Quote PDF fout:", err);
    return NextResponse.json({ error: "PDF generatie mislukt", detail: String(err) }, { status: 500 });
  }
}
