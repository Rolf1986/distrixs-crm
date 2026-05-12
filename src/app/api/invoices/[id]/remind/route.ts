import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyInfo } from "@/lib/companySettings";
import { sendEmail, buildEmailHtml } from "@/lib/email";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/components/InvoicePdf";
import { formatCurrency } from "@/lib/utils";

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
    to: string; cc?: string; subject: string; message: string;
  };

  if (!to?.trim()) {
    return NextResponse.json({ error: "E-mailadres verplicht" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: { include: { addresses: { where: { isDefault: true }, take: 1 } } },
      contact: true,
      quote: { select: { quoteNumber: true } },
      lines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Factuur is al betaald" }, { status: 400 });
  }

  const company = await getCompanyInfo();
  const addr = invoice.customer.addresses[0];
  const addrStr = addr ? `${addr.street} ${addr.houseNumber}, ${addr.postalCode} ${addr.city}` : undefined;

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
      ? { firstName: invoice.contact.firstName, lastName: invoice.contact.lastName, email: invoice.contact.email }
      : null,
    lines: invoice.lines.map((l) => ({
      skuSnapshot: l.skuSnapshot, titleSnapshot: l.titleSnapshot,
      qty: Number(l.qty), grossUnitPrice: Number(l.grossUnitPrice),
      discountPercent: Number(l.discountPercent), netLineTotal: Number(l.netLineTotal),
    })),
  };

  const element = createElement(InvoicePdf, { data: pdfData });
  const pdfBuffer = await renderToBuffer(element as never);

  const recipientName = invoice.contact
    ? `${invoice.contact.firstName} ${invoice.contact.lastName}` : undefined;

  const dueDate = new Intl.DateTimeFormat("nl-NL").format(new Date(invoice.dueDate));
  const openAmount = formatCurrency(Number(invoice.openAmount));

  const messageLines = message.split("\n").filter(Boolean)
    .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

  const paymentInfo = `<p style="margin:16px 0 0 0;padding:12px 16px;background:#fff7ed;border-radius:8px;font-size:13px;color:#9a3412;"><strong>Openstaand bedrag:</strong> ${openAmount}<br><strong>Factuurnummer:</strong> ${invoice.invoiceNumber}${company.iban ? `<br><strong>IBAN:</strong> ${company.iban}` : ""}<br><strong>Vervaldatum:</strong> ${dueDate}</p>`;

  const html = buildEmailHtml({
    companyName: company.companyName,
    recipientName,
    subject,
    bodyLines: [...messageLines, "__PAYMENT_INFO__"],
    footerLines: [
      company.email ? `E-mail: ${company.email}` : "",
      company.phone ? `Telefoon: ${company.phone}` : "",
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

  // Log reminder in InvoiceReminder tabel
  await prisma.invoiceReminder.create({
    data: {
      invoiceId: id,
      reminderType: "FIRST",
      sentAt: new Date(),
      channel: "EMAIL",
      status: "SENT",
      notes: `Verstuurd naar ${to.trim()}`,
    },
  }).catch(() => {
    // Reminder logging is niet kritisch — ga door ook bij fout
  });

  return NextResponse.json({ ok: true, simulated: result.simulated ?? false });
}
