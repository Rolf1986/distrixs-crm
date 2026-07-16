import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildEmailHtml } from "@/lib/email";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/components/pdf/InvoicePdf";
import { buildInvoicePdfData } from "@/lib/pdf-data";
import { formatCurrency } from "@/lib/utils";
import { logSentEmail } from "@/lib/sent-email";

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
    to: string; cc?: string; subject: string; message: string;
  };

  if (!to?.trim()) {
    return NextResponse.json({ error: "E-mailadres verplicht" }, { status: 400 });
  }

  // PDF via gedeelde databouwer (zelfde layout als de download-route)
  const built = await buildInvoicePdfData(id);
  if (!built) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  const { invoice, company, data: pdfData } = built;

  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Factuur is al betaald" }, { status: 400 });
  }

  const element = createElement(InvoicePdf, { data: pdfData });
  const pdfBuffer = await renderToBuffer(element as never);

  const recipientName = invoice.contact
    ? `${invoice.contact.firstName} ${invoice.contact.lastName}` : undefined;

  const dueDate = new Intl.DateTimeFormat("nl-NL").format(new Date(invoice.dueDate));
  const openAmount = formatCurrency(Number(invoice.openAmount));

  const messageLines = message.split("\n").filter(Boolean)
    .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

  const paymentInfo = `<p style="margin:16px 0 0 0;padding:12px 16px;background:#fff7ed;border-radius:8px;font-size:13px;color:#9a3412;"><strong>Openstaand bedrag:</strong> ${openAmount}<br><strong>Factuurnummer:</strong> ${invoice.invoiceNumber}${company.iban ? `<br><strong>IBAN:</strong> ${company.iban}` : ""}${company.ibanAccountHolder ? `<br><strong>T.n.v.:</strong> ${company.ibanAccountHolder}` : ""}<br><strong>Vervaldatum:</strong> ${dueDate}</p>`;

  const html = buildEmailHtml({
    companyName: company.companyName,
    logoUrl: company.logoUrl,
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

  // Verstuurde herinnering vastleggen voor de geschiedenis (incl. inhoud)
  await prisma.invoiceEmail.create({
    data: {
      invoiceId: id,
      kind: "REMINDER",
      toAddress: to.trim(),
      ccAddress: cc?.trim() || null,
      subject,
      bodyHtml: html,
      createdBy: session.user.id,
    },
  }).catch((e) => console.warn("[invoice remind] mail-log niet opgeslagen:", e));

  await logSentEmail({
    category: "REMINDER",
    to: to.trim(),
    cc: cc?.trim() || null,
    subject,
    bodyHtml: html,
    relatedType: "Invoice",
    relatedId: id,
    relatedLabel: invoice.invoiceNumber,
    customerName: invoice.customer?.companyName ?? null,
    createdBy: session.user.id,
  });

  return NextResponse.json({ ok: true, simulated: result.simulated ?? false });
}
