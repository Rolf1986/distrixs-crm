import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/components/pdf/InvoicePdf";
import { buildInvoicePdfData } from "@/lib/pdf-data";
import { sendEmail, buildEmailHtml } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";
import { createMolliePaymentLink } from "@/lib/mollie";
import { nextInvoiceNumber } from "@/lib/sequences";
import { logSentEmail } from "@/lib/sent-email";
import { syncInvoiceToTwinfield, isTwinfieldAutoSyncEnabled, type TwinfieldSyncResult } from "@/lib/twinfield";

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
  const { to, cc } = body as { to: string; cc?: string };
  let { subject, message } = body as { subject: string; message: string };

  if (!to?.trim()) {
    return NextResponse.json({ error: "E-mailadres verplicht" }, { status: 400 });
  }

  // Concept dat voor het eerst verzonden wordt krijgt nu zijn definitieve nummer
  const current = await prisma.invoice.findUnique({
    where: { id },
    select: { invoiceNumber: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }
  if (current.invoiceNumber.startsWith("DRAFT-")) {
    const definitiveNumber = await nextInvoiceNumber(new Date().getFullYear());
    await prisma.invoice.update({
      where: { id },
      data: { invoiceNumber: definitiveNumber },
    });
    // Onderwerp/bericht zijn in het venster vaak vooraf ingevuld met het
    // DRAFT-nummer → vervang dat door het definitieve nummer.
    subject = (subject ?? "").split(current.invoiceNumber).join(definitiveNumber);
    message = (message ?? "").split(current.invoiceNumber).join(definitiveNumber);
  }

  // PDF via gedeelde databouwer (zelfde layout als de download-route)
  const built = await buildInvoicePdfData(id);
  if (!built) {
    return NextResponse.json({ error: "Factuur niet gevonden" }, { status: 404 });
  }
  const { invoice, company } = built;
  const pdfData = { ...built.data, isDraft: false };

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
    ? `<p style="margin:16px 0 0 0;padding:12px 16px;background:#f0fdf4;border-radius:8px;font-size:13px;color:#166534;"><strong>Betaalkenmerk:</strong> ${invoice.invoiceNumber}<br><strong>IBAN:</strong> ${company.iban}${company.ibanAccountHolder ? `<br><strong>T.n.v.:</strong> ${company.ibanAccountHolder}` : ""}${company.bic ? `<br><strong>BIC:</strong> ${company.bic}` : ""}<br><strong>Bedrag:</strong> ${totalStr}<br><strong>Vervaldatum:</strong> ${dueDate}</p>`
    : "";

  // Online-betaalknop (Mollie) voor het openstaande bedrag — fail-soft:
  // lukt het aanmaken niet, dan gaat de mail zonder knop de deur uit
  let paymentCtaUrl: string | undefined;
  if (Number(invoice.openAmount) > 0 && invoice.status !== "PAID" && invoice.status !== "CREDITED") {
    const link = await createMolliePaymentLink(id);
    if (link.ok) {
      paymentCtaUrl = link.checkoutUrl;
    } else if (link.error !== "MOLLIE_API_KEY niet ingesteld") {
      console.warn(`[invoice send] betaallink niet aangemaakt voor ${invoice.invoiceNumber}: ${link.error}`);
    }
  }

  const html = buildEmailHtml({
    companyName: company.companyName,
    logoUrl: company.logoUrl,
    recipientName,
    subject,
    ctaUrl: paymentCtaUrl,
    ctaLabel: paymentCtaUrl ? `Betaal online (${formatCurrency(Number(invoice.openAmount))})` : undefined,
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

  // Verstuurde mail vastleggen voor de geschiedenis (incl. inhoud om in te zien)
  await prisma.invoiceEmail.create({
    data: {
      invoiceId: id,
      kind: "INVOICE",
      toAddress: to.trim(),
      ccAddress: cc?.trim() || null,
      subject,
      bodyHtml: html,
      createdBy: session.user.id,
    },
  }).catch((e) => console.warn("[invoice send] mail-log niet opgeslagen:", e));

  await logSentEmail({
    category: "INVOICE",
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

  // Status DRAFT → SENT
  if (invoice.status === "DRAFT") {
    await prisma.invoice.update({
      where: { id },
      data: { status: "SENT" },
    });
  }

  // Automatisch naar Twinfield boeken (fail-soft: mislukt dit, dan is de mail
  // al verstuurd en kan de factuur later handmatig via de knop). Al geboekte
  // facturen worden overgeslagen door syncInvoiceToTwinfield.
  let twinfield: TwinfieldSyncResult | null = null;
  if (await isTwinfieldAutoSyncEnabled()) {
    try {
      twinfield = await syncInvoiceToTwinfield(id);
      if (!twinfield.success) {
        console.warn(`[invoice send] Twinfield-boeking mislukt voor ${invoice.invoiceNumber}: ${twinfield.error}`);
      }
    } catch (e) {
      console.warn(`[invoice send] Twinfield-boeking fout voor ${invoice.invoiceNumber}:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    simulated: result.simulated ?? false,
    emailId: result.id,
    twinfield: twinfield ? { success: twinfield.success, error: twinfield.error } : null,
  });
}
