import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/components/pdf/InvoicePdf";
import { getCompanyInfo } from "@/lib/companySettings";

const PAYMENT_TERM_DAYS: Record<string, number> = {
  DAYS_14: 14,
  DAYS_30: 30,
  PREPAYMENT: 0,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: {
        include: { addresses: { where: { type: "BILLING", isDefault: true }, take: 1 } },
      },
      contact: true,
      lines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const company = await getCompanyInfo();
  const addr = invoice.customer.addresses[0];

  const data = {
    language: invoice.language ?? "NL",
    isDraft: invoice.status === "DRAFT",
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    paymentTermDays: PAYMENT_TERM_DAYS[invoice.paymentTermType] ?? 30,
    ourReference: invoice.ourReference,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
    openAmount: Number(invoice.openAmount),
    company,
    customer: {
      companyName: invoice.customer.companyName,
      contactName: invoice.contact
        ? `${invoice.contact.firstName} ${invoice.contact.lastName}`
        : null,
      address: addr ? `${addr.street} ${addr.houseNumber}` : null,
      postalCode: addr?.postalCode ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
    },
    lines: invoice.lines.map((l) => ({
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
    const element = createElement(InvoicePdf, { data });
    const buffer = await renderToBuffer(element as never);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Invoice PDF fout:", err);
    return NextResponse.json({ error: "PDF generatie mislukt", detail: String(err) }, { status: 500 });
  }
}
