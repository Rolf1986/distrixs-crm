import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { TabNav } from "@/components/TabNav";
import { InvoiceStatusActions } from "@/components/InvoiceStatusActions";
import { OurReferenceEditor } from "@/components/OurReferenceEditor";
import { SendDocumentButton } from "@/components/SendDocumentButton";
import { SendReminderButton } from "@/components/SendReminderButton";
import { MolliePaymentButton } from "@/components/MolliePaymentButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { CreateCreditNoteButton } from "@/components/CreateCreditNoteButton";
import { DeleteInvoiceButton } from "@/components/DeleteInvoiceButton";

async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: { select: { companyName: true, id: true } },
      deal: { select: { id: true, dealNumber: true } },
      quote: { select: { id: true, quoteNumber: true } },
      contact: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

async function getAdjacentInvoices(_currentId: string, invoiceDate: Date) {
  const [prev, next] = await Promise.all([
    prisma.invoice.findFirst({
      where: { invoiceDate: { lt: invoiceDate } },
      orderBy: { invoiceDate: "desc" },
      select: { id: true, invoiceNumber: true },
    }),
    prisma.invoice.findFirst({
      where: { invoiceDate: { gt: invoiceDate } },
      orderBy: { invoiceDate: "asc" },
      select: { id: true, invoiceNumber: true },
    }),
  ]);
  return { prev, next };
}

export default async function InvoiceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const { prev, next } = await getAdjacentInvoices(id, invoice.invoiceDate);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb + prev/next nav */}
      <div className="px-8 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <Link href="/invoices" className="hover:text-slate-600 transition-colors">Facturen</Link>
          {invoice.deal && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href={`/deals/${invoice.deal.id}/invoices`} className="hover:text-slate-600 transition-colors">
                {invoice.deal.dealNumber}
              </Link>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-600 font-medium font-mono">{invoice.invoiceNumber}</span>
        </div>
        {/* Prev / Next navigation */}
        <div className="flex items-center gap-1">
          {prev ? (
            <Link
              href={`/invoices/${prev.id}/lines`}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors bg-white"
              title={prev.invoiceNumber}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="font-mono">{prev.invoiceNumber}</span>
            </Link>
          ) : (
            <span className="px-2.5 py-1 text-xs text-slate-300 border border-slate-100 rounded-lg bg-white">
              <ChevronLeft className="w-3.5 h-3.5 inline" />
            </span>
          )}
          {next ? (
            <Link
              href={`/invoices/${next.id}/lines`}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors bg-white"
              title={next.invoiceNumber}
            >
              <span className="font-mono">{next.invoiceNumber}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <span className="px-2.5 py-1 text-xs text-slate-300 border border-slate-100 rounded-lg bg-white">
              <ChevronRight className="w-3.5 h-3.5 inline" />
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="px-8 pt-3 pb-5 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900 font-mono">{invoice.invoiceNumber}</h1>
              <StatusBadge status={invoice.status} type="invoice" />
              {invoice.twinfieldLocked && (
                <span className="text-xs text-slate-400 border border-slate-200 rounded px-2 py-1">
                  🔒 Twinfield
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
              <Link href={`/customers/${invoice.customer.id}`} className="text-brand-blue hover:underline">
                {invoice.customer.companyName}
              </Link>
              {invoice.contact && (
                <span className="text-slate-400">
                  · {invoice.contact.firstName} {invoice.contact.lastName}
                </span>
              )}
              <span className="text-slate-400">· {formatDate(invoice.invoiceDate)}</span>
              <span className="text-slate-400">· vervalt {formatDate(invoice.dueDate)}</span>
              <OurReferenceEditor invoiceId={id} value={invoice.ourReference ?? null} />
              {invoice.quote && (
                <Link
                  href={`/quotes/${invoice.quote.id}/lines`}
                  className="text-blue-500 hover:text-brand-blue transition-colors"
                >
                  · {invoice.quote.quoteNumber}
                </Link>
              )}
            </div>
          </div>

          {/* Actieknoppen */}
          <div className="flex items-center gap-2">
            <DeleteInvoiceButton invoiceId={id} status={invoice.status} />
            <CreateCreditNoteButton
              invoiceId={id}
              invoiceNumber={invoice.invoiceNumber}
              status={invoice.status}
            />
            {/* Altijd zichtbare PDF-downloadknop */}
            <a
              href={`/api/invoices/${id}/pdf`}
              download={`${invoice.invoiceNumber}.pdf`}
              className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </a>
            <LanguageToggle
              documentType="invoice"
              documentId={id}
              currentLanguage={"language" in invoice ? (invoice.language as string) : "NL"}
            />
            <MolliePaymentButton
              invoiceId={id}
              invoiceNumber={invoice.invoiceNumber}
              openAmount={Number(invoice.openAmount)}
              status={invoice.status}
            />
            <SendReminderButton
              invoiceId={id}
              invoiceNumber={invoice.invoiceNumber}
              currentStatus={invoice.status}
              defaultTo={invoice.contact?.email ?? ""}
              daysOverdue={
                invoice.dueDate && new Date(invoice.dueDate) < new Date()
                  ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000)
                  : 0
              }
            />
            <SendDocumentButton
              type="invoice"
              documentId={id}
              documentNumber={invoice.invoiceNumber}
              currentStatus={invoice.status}
              defaultTo={invoice.contact?.email ?? ""}
              documentLanguage={"language" in invoice ? (invoice.language as string) : "NL"}
            />
            <InvoiceStatusActions
              invoiceId={id}
              currentStatus={invoice.status as "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CREDITED"}
              twinfieldLocked={invoice.twinfieldLocked}
            />
          </div>
        </div>

        {/* KPI's */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <KpiCard label="Subtotaal excl. BTW" value={formatCurrency(Number(invoice.subtotal))} />
          <KpiCard label="BTW 21%" value={formatCurrency(Number(invoice.vatAmount))} />
          <KpiCard label="Totaal incl. BTW" value={formatCurrency(Number(invoice.total))} />
          <KpiCard
            label="Open bedrag"
            value={formatCurrency(Number(invoice.openAmount))}
            highlight={Number(invoice.openAmount) > 0}
          />
        </div>

        {/* Tabs */}
        <TabNav tabs={[
          { label: "Regels",         href: `/invoices/${id}/lines` },
          { label: "Betalingen",     href: `/invoices/${id}/payments` },
          { label: "Termijnen",      href: `/invoices/${id}/installments` },
          { label: "Creditnota's",   href: `/invoices/${id}/credit-notes` },
          { label: "Geschiedenis",   href: `/invoices/${id}/audit` },
          { label: "PDF / Download", href: `/invoices/${id}/pdf` },
        ]} />
      </div>

      {/* Tab content */}
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
