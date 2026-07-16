import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { CreditNotePdf } from "@/components/pdf/CreditNotePdf";
import { buildCreditNotePdfData } from "@/lib/pdf-data";
import { sendEmail, buildEmailHtml } from "@/lib/email";
import { logSentEmail } from "@/lib/sent-email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const { to, cc, subject, message } = await req.json() as {
    to: string; cc?: string; subject?: string; message?: string;
  };
  if (!to?.trim()) return NextResponse.json({ error: "E-mailadres verplicht" }, { status: 400 });

  const built = await buildCreditNotePdfData(id);
  if (!built) return NextResponse.json({ error: "Creditnota niet gevonden" }, { status: 404 });
  const { data, company } = built;

  const element = createElement(CreditNotePdf, { data });
  const pdfBuffer = await renderToBuffer(element as never);

  const finalSubject = subject?.trim() || `Creditnota ${data.creditNoteNumber}`;
  const defaultBody = `Beste,\n\nHierbij ontvangt u creditnota ${data.creditNoteNumber}${data.invoiceNumber ? ` met betrekking tot factuur ${data.invoiceNumber}` : ""}.\n\nMet vriendelijke groet,\n${company.companyName ?? "Distrixs"}`;
  const messageLines = (message?.trim() || defaultBody)
    .split("\n")
    .filter(Boolean)
    .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

  const html = buildEmailHtml({
    companyName: company.companyName,
    logoUrl: company.logoUrl,
    subject: finalSubject,
    bodyLines: messageLines,
    footerLines: [
      company.email ? `E-mail: ${company.email}` : "",
      company.phone ? `Telefoon: ${company.phone}` : "",
      company.kvkNumber ? `KvK: ${company.kvkNumber}` : "",
    ].filter(Boolean),
  });

  const safeName = data.creditNoteNumber.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
  const result = await sendEmail({
    to: to.trim(),
    cc: cc?.trim() ? [cc.trim()] : undefined,
    subject: finalSubject,
    html,
    attachments: [{ filename: `${safeName}.pdf`, content: pdfBuffer }],
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Versturen mislukt" }, { status: 500 });
  }

  await logSentEmail({
    category: "CREDIT_NOTE",
    to: to.trim(),
    cc: cc?.trim() || null,
    subject: finalSubject,
    bodyHtml: html,
    relatedType: "CreditNote",
    relatedId: id,
    relatedLabel: data.creditNoteNumber,
    customerName: data.customer.companyName ?? null,
    createdBy: session.user.id,
  });

  return NextResponse.json({ ok: true, simulated: result.simulated ?? false });
}
