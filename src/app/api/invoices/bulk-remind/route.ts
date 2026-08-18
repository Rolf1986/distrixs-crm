import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyInfo } from "@/lib/companySettings";
import { sendEmail, buildEmailHtml } from "@/lib/email";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/components/pdf/InvoicePdf";
import { buildInvoicePdfData } from "@/lib/pdf-data";
import { formatCurrency } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { invoiceIds } = (await req.json()) as { invoiceIds: string[] };
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return NextResponse.json({ error: "Geen factuur-IDs opgegeven" }, { status: 400 });
  }

  const company = await getCompanyInfo();
  let sent = 0;
  let simulated = 0;
  const errors: string[] = [];

  for (const id of invoiceIds) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: { include: { addresses: { where: { isDefault: true }, take: 1 }, contacts: { where: { isPrimary: true }, take: 1 } } },
          contact: true,
          quote: { select: { quoteNumber: true } },
          lines: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!invoice) { errors.push(`${id}: niet gevonden`); continue; }
      if (invoice.status === "PAID" || invoice.status === "CREDITED") {
        errors.push(`${invoice.invoiceNumber}: al betaald/gecrediteerd`);
        continue;
      }

      // Determine recipient
      const primaryContact = invoice.contact ?? invoice.customer.contacts[0] ?? null;
      const to = primaryContact?.email ?? null;
      if (!to) {
        errors.push(`${invoice.invoiceNumber}: geen e-mailadres beschikbaar`);
        continue;
      }

      // PDF via gedeelde databouwer (zelfde layout als de download-route)
      const built = await buildInvoicePdfData(invoice.id);
      if (!built) {
        errors.push(`${invoice.invoiceNumber}: factuur niet gevonden`);
        continue;
      }

      const element = createElement(InvoicePdf, { data: built.data });
      const pdfBuffer = await renderToBuffer(element as never);

      const dueDate = new Intl.DateTimeFormat("nl-NL").format(new Date(invoice.dueDate));
      const openAmount = formatCurrency(Number(invoice.openAmount));
      const recipientName = primaryContact
        ? `${primaryContact.firstName} ${primaryContact.lastName}`
        : undefined;

      // Zelfde placeholders als op de instellingenpagina gedocumenteerd
      const applyVars = (t: string) =>
        t
          .replaceAll("{documentNumber}", invoice.invoiceNumber)
          .replaceAll("{invoiceNumber}", invoice.invoiceNumber)
          .replaceAll("{customerName}", invoice.customer.companyName)
          .replaceAll("{dueDate}", dueDate)
          .replaceAll("{openAmount}", openAmount)
          .replaceAll("{total}", formatCurrency(Number(invoice.total)))
          .replaceAll("{companyName}", company.companyName);
      const subject = company.reminderEmailSubject
        ? applyVars(company.reminderEmailSubject)
        : `Herinnering: factuur ${invoice.invoiceNumber}`;
      const messageTemplate = company.reminderEmailBody
        ? applyVars(company.reminderEmailBody)
        : `Geachte relatie,\n\nWij willen u vriendelijk herinneren aan de openstaande factuur ${invoice.invoiceNumber} met een openstaand bedrag van ${openAmount}.\n\nMet vriendelijke groet,\n${company.companyName}`;

      const messageLines = messageTemplate.split("\n").filter(Boolean)
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
      }).replace('<p style="margin:0 0 12px 0;color:#374151;">__PAYMENT_INFO__</p>', paymentInfo);

      const result = await sendEmail({
        to,
        subject,
        html,
        attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
      });

      if (!result.ok) {
        errors.push(`${invoice.invoiceNumber}: ${result.error ?? "versturen mislukt"}`);
        continue;
      }

      // Log reminder
      await prisma.invoiceReminder.create({
        data: {
          invoiceId: id,
          reminderType: "FIRST",
          sentAt: new Date(),
          channel: "EMAIL",
          status: "SENT",
          notes: `Bulk herinnering verstuurd naar ${to}`,
        },
      }).catch(() => {});

      if (result.simulated) {
        simulated++;
      } else {
        sent++;
      }
    } catch (err) {
      errors.push(`${id}: onverwachte fout – ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ sent, simulated, errors });
}
