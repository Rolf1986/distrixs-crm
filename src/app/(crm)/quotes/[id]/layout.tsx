import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { TabNav } from "@/components/TabNav";
import { QuoteStatusActions } from "@/components/QuoteStatusActions";
import { CreateInvoiceButton } from "@/components/CreateInvoiceButton";
import { SendDocumentButton } from "@/components/SendDocumentButton";
import { ValidUntilEditor } from "@/components/ValidUntilEditor";
import { LanguageToggle } from "@/components/LanguageToggle";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ChevronRight, Download } from "lucide-react";
import { DeleteQuoteButton } from "@/components/DeleteQuoteButton";

async function getQuote(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          companyName: true,
          email: true,
          contacts: {
            where: { isActive: true, email: { not: null } },
            select: { firstName: true, lastName: true, email: true, isPrimary: true },
            orderBy: { isPrimary: "desc" },
          },
        },
      },
      deal: { select: { id: true, title: true, dealNumber: true } },
      contact: { select: { firstName: true, lastName: true, email: true } },
      lines: { select: { expectedMarginSnapshot: true } },
      _count: { select: { invoices: true } },
    },
  });
}

export default async function QuoteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  const marge = quote.lines.reduce((s, l) => s + Number(l.expectedMarginSnapshot), 0);

  // E-mailadressen van de klantkaart: hoofd-/factuuradres + contactpersonen
  const emailOptions = [
    ...(quote.customer.email
      ? [{ label: `${quote.customer.companyName} (hoofdadres)`, email: quote.customer.email }]
      : []),
    ...quote.customer.contacts
      .filter((c) => !!c.email)
      .map((c) => ({
        label: `${c.firstName} ${c.lastName}${c.isPrimary ? " (primair contact)" : ""}`,
        email: c.email as string,
      })),
  ];
  const margePct = Number(quote.subtotal) > 0 ? (marge / Number(quote.subtotal)) * 100 : 0;
  const gefactureerd = quote._count.invoices > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/quotes" className="hover:text-slate-600 transition-colors">Offertes</Link>
        {quote.deal && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href={`/deals/${quote.deal.id}/quotes`} className="hover:text-slate-600 transition-colors">
              {quote.deal.dealNumber}
            </Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-600 font-medium font-mono">{quote.quoteNumber}</span>
      </div>

      {/* Header */}
      <div className="px-8 pt-3 pb-5 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900 font-mono">{quote.quoteNumber}</h1>
              <StatusBadge status={quote.status} type="quote" />
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
              <span>{quote.customer.companyName}</span>
              {quote.contact && (
                <span className="text-slate-400">
                  · {quote.contact.firstName} {quote.contact.lastName}
                </span>
              )}
              <span className="text-slate-400">· {formatDate(quote.quoteDate)}</span>
              <ValidUntilEditor quoteId={id} value={quote.validUntil ?? null} />
            </div>
          </div>

          {/* Actieknoppen */}
          <div className="flex items-center gap-2">
            <DeleteQuoteButton quoteId={id} status={quote.status} />
            <LanguageToggle
              documentType="quote"
              documentId={id}
              currentLanguage={"language" in quote ? (quote.language as string) : "NL"}
            />
            {(quote.status === "ACCEPTED" || quote.status === "SENT") && (
              <CreateInvoiceButton quoteId={id} />
            )}
            {/* Altijd zichtbare PDF-downloadknop */}
            <a
              href={`/api/quotes/${id}/pdf`}
              download={`${quote.quoteNumber}.pdf`}
              className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </a>
            <SendDocumentButton
              type="quote"
              documentId={id}
              documentNumber={quote.quoteNumber}
              currentStatus={quote.status}
              defaultTo={quote.contact?.email ?? quote.customer.email ?? ""}
              documentLanguage={"language" in quote ? (quote.language as string) : "NL"}
              emailOptions={emailOptions}
            />
            <QuoteStatusActions quoteId={id} currentStatus={quote.status} />
          </div>
        </div>

        {/* KPI's */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <KpiCard label="Subtotaal excl. BTW" value={formatCurrency(Number(quote.subtotal))} />
          <KpiCard label="BTW 21%" value={formatCurrency(Number(quote.vatAmount))} />
          <KpiCard label="Totaal incl. BTW" value={formatCurrency(Number(quote.total))} />
          <KpiCard
            label="Verwachte marge"
            value={formatCurrency(marge)}
            sub={`${margePct.toFixed(1)}% · ${gefactureerd ? "Gefactureerd ✓" : "Niet gefactureerd"}`}
            highlight={marge > 0}
          />
        </div>

        {/* Tabs */}
        <TabNav tabs={[
          { label: "Regels",      href: `/quotes/${id}/lines` },
          { label: "PDF / Download", href: `/quotes/${id}/pdf` },
        ]} />
      </div>

      {/* Tab content */}
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
