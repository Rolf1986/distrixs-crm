import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { QuotePdf } from "@/components/pdf/QuotePdf";
import { buildQuotePdfData } from "@/lib/pdf-data";
import { sendEmail, buildEmailHtml } from "@/lib/email";
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
  const { to, cc, subject, message, greeting } = body as {
    to: string;
    cc?: string;
    subject: string;
    message: string;
    greeting?: string;
  };

  if (!to?.trim()) {
    return NextResponse.json({ error: "E-mailadres verplicht" }, { status: 400 });
  }

  // PDF via gedeelde databouwer (zelfde layout als de download-route)
  const built = await buildQuotePdfData(id);
  if (!built) {
    return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  }
  const { quote, company, data: pdfData } = built;

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
    logoUrl: company.logoUrl,
    recipientName,
    greeting,
    subject: finalSubject,
    bodyLines: messageLines,
    footerLines: [
      company.email ? `E-mail: ${company.email}` : "",
      company.phone ? `Telefoon: ${company.phone}` : "",
      company.kvkNumber ? `KvK: ${company.kvkNumber}` : "",
    ].filter(Boolean),
  });

  // Offertes gaan vanuit info@ zodat de klant direct kan antwoorden
  const result = await sendEmail({
    to: to.trim(),
    cc: cc?.trim() ? [cc.trim()] : undefined,
    subject: finalSubject,
    html,
    from: "Distrixs <info@distrixs.nl>",
    replyTo: "info@distrixs.nl",
    attachments: [{ filename: `${quote.quoteNumber}.pdf`, content: pdfBuffer }],
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Versturen mislukt" }, { status: 500 });
  }

  // Verstuurde mail vastleggen voor de geschiedenis (incl. inhoud)
  await prisma.quoteEmail.create({
    data: {
      quoteId: id,
      toAddress: to.trim(),
      ccAddress: cc?.trim() || null,
      subject: finalSubject,
      bodyHtml: html,
      createdBy: session.user.id,
    },
  }).catch((e) => console.warn("[quote send] mail-log niet opgeslagen:", e));

  await logSentEmail({
    category: "QUOTE",
    to: to.trim(),
    cc: cc?.trim() || null,
    subject: finalSubject,
    bodyHtml: html,
    relatedType: "Quote",
    relatedId: id,
    relatedLabel: quote.quoteNumber,
    customerName: quote.customer?.companyName ?? null,
    createdBy: session.user.id,
  });

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
