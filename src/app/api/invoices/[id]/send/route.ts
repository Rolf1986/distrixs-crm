import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/components/InvoicePdf";
import { getCompanyInfo } from "@/lib/companySettings";
import { sendEmail, buildEmailHtml } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
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

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: {
        include: { addresses: { where: { isDefault: true }, take: 1 } },
      },
      contact: true,
      quote: { select: { quoteNumber: true } },
      lines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }

  const company = await getCompanyInfo();

  // Genereer PDF
  const addr = invoice.customer.addresses[0];
  const addrStr = addr
    ? `${addr.street} ${addr.houseNumber}, ${addr.postalCode} ${addr.city}`
    : undefined;

  const pdfData = {
    company,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
    openAmount: Number(invoice.openAmount),
    quoteNumber: invoice.quote?.quoteNumber ?? null,
    ourReference: invoice.ourReference ?? null,
    customer: {
      companyName: invoice.customer.companyName,
      kvkNumber: invoice.customer.kvkNumber,
      vatNumber: invoice.customer.vatNumber,
      address: addrStr,
    },
    contact: invoice.contact
      ? {
          firstName: invoice.contact.firstName,
          lastName: invoice.contact.lastName,
          email: invoice.contact.email,
        }
      : null,
    lines: invoice.lines.map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      qty: Number(l.qty),
      grossUnitPrice: Number(l.grossUnitPrice),
      discountPercent: Number(l.discountPercent),
      netLineTotal: Number(l.netLineTotal),
    })),
  };

  const element = createElement(InvoicePdf, { data: pdfData });
  const pdfBuffer = await renderToBuffer(element as never);

  // E-mail
  const recipientName = invoice.contact
    ? `${invoice.contact.firstName} ${invoice.contact.lastName}`
    : undefined;

  const dueDate = new Intl.DateTimeFormat("nl-NL").format(new Date(invoice.dueDate));
  const totalStr = formatCurrency(Number(invoice.total));

  const messageLines = message
    .split("\n")
    .filter(Boolean)
    .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

  const paymentInfo = company.iban
    ? `<p style="margin:16px 0 0 0;padding:12px 16px;background:#f0fdf4;border-radius:8px;font-size:13px;color:#166534;"><strong>Betaalkenmerk:</strong> ${invoice.invoiceNumber}<br><strong>IBAN:</strong> ${company.iban}${company.bic ? `<br><strong>BIC:</strong> ${company.bic}` : ""}<br><strong>Bedrag:</strong> ${totalStr}<br><strong>Vervaldatum:</strong> ${dueDate}</p>`
    : "";

  const html = buildEmailHtml({
    companyName: company.companyName,
    recipientName,
    subject,
    bodyLines: [
      ...messageLines,
      paymentInfo ? "__PAYMENT_INFO__" : "",
    ].filter(Boolean),
    footerLines: [
      company.email ? `E-mail: ${company.email}` : "",
      company.phone ? `Telefoon: ${company.phone}` : "",
      company.kvkNumber ? `KvK: ${company.kvkNumber}` : "",
      company.vatNumber ? `BTW: ${company.vatNumber}` : "",
    ].filter(Boolean),
  }).replace("<p style=\"margin:0 0 12px 0;color:#374151;\">__PAYMENT_INFO__</p>", paymentInfo);

  const result = await sendEmail({
    to: to.trim(),
    cc: cc?.trim() ? [cc.trim()] : undefined,
    subject,
    html,
    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Versturen mislukt" }, { status: 500 });
  }

  // Status DRAFT → SENT
  if (invoice.status === "DRAFT") {
    await prisma.invoice.update({ where: { id }, data: { status: "SENT" } });
  }

  return NextResponse.json({
    ok: true,
    simulated: result.simulated ?? false,
    emailId: result.id,
  });
}
