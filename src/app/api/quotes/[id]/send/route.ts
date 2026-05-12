import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { QuotePdf } from "@/components/QuotePdf";
import { getCompanyInfo } from "@/lib/companySettings";
import { sendEmail, buildEmailHtml } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { to, cc, subject, message } = body as {
    to: string;
    cc?: string;
    subject: string;
    message: string;
  };

  if (!to?.trim()) {
    return NextResponse.json({ error: "E-mailadres verplicht" }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: {
        include: { addresses: { where: { isDefault: true }, take: 1 } },
      },
      contact: true,
      lines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  }

  const company = await getCompanyInfo();

  // Genereer PDF
  const addr = quote.customer.addresses[0];
  const addrStr = addr
    ? `${addr.street} ${addr.houseNumber}, ${addr.postalCode} ${addr.city}`
    : undefined;

  const pdfData = {
    company,
    quoteNumber: quote.quoteNumber,
    quoteDate: quote.quoteDate,
    validUntil: quote.validUntil,
    subtotal: Number(quote.subtotal),
    vatAmount: Number(quote.vatAmount),
    total: Number(quote.total),
    customer: {
      companyName: quote.customer.companyName,
      kvkNumber: quote.customer.kvkNumber,
      vatNumber: quote.customer.vatNumber,
      address: addrStr,
    },
    contact: quote.contact
      ? {
          firstName: quote.contact.firstName,
          lastName: quote.contact.lastName,
          email: quote.contact.email,
        }
      : null,
    lines: quote.lines.map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      qty: Number(l.qty),
      grossUnitPrice: Number(l.grossUnitPrice),
      discountPercent: Number(l.discountPercent),
      netLineTotal: Number(l.netLineTotal),
    })),
  };

  const element = createElement(QuotePdf, { data: pdfData });
  const pdfBuffer = await renderToBuffer(element as never);

  // E-mail inhoud
  const recipientName = quote.contact
    ? `${quote.contact.firstName} ${quote.contact.lastName}`
    : undefined;

  // Gebruik template uit instellingen als geen custom bericht opgegeven
  const finalMessage = message.trim() || (company.quoteEmailBody ?? "");
  const finalSubject = subject.trim() || (company.quoteEmailSubject ?? `Offerte ${quote.quoteNumber}`);

  const messageLines = finalMessage
    .split("\n")
    .filter(Boolean)
    .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

  const html = buildEmailHtml({
    companyName: company.companyName,
    recipientName,
    subject: finalSubject,
    bodyLines: messageLines,
    footerLines: [
      company.email ? `E-mail: ${company.email}` : "",
      company.phone ? `Telefoon: ${company.phone}` : "",
      company.kvkNumber ? `KvK: ${company.kvkNumber}` : "",
    ].filter(Boolean),
  });

  const result = await sendEmail({
    to: to.trim(),
    cc: cc?.trim() ? [cc.trim()] : undefined,
    subject: finalSubject,
    html,
    attachments: [{ filename: `${quote.quoteNumber}.pdf`, content: pdfBuffer }],
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Versturen mislukt" }, { status: 500 });
  }

  // Zet status op SENT (als nog DRAFT)
  if (quote.status === "DRAFT") {
    await prisma.quote.update({ where: { id }, data: { status: "SENT" } });
  }

  return NextResponse.json({
    ok: true,
    simulated: result.simulated ?? false,
    emailId: result.id,
  });
}
