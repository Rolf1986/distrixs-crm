import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate, formatCurrency } from "@/lib/utils";
import { RecurringInvoiceDetailClient } from "./RecurringInvoiceDetailClient";

type Params = { params: Promise<{ id: string }> };

async function getData(id: string) {
  const [recurring, generatedInvoices] = await Promise.all([
    prisma.recurringInvoice.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, companyName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, dealNumber: true, title: true } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.invoice.findMany({
      where: { recurringInvoiceId: id },
      include: { customer: { select: { companyName: true } } },
      orderBy: { invoiceDate: "desc" },
    }),
  ]);

  return { recurring, generatedInvoices };
}

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Wekelijks",
  MONTHLY: "Maandelijks",
  QUARTERLY: "Kwartaal",
  YEARLY: "Jaarlijks",
};

const PAYMENT_TERM_LABELS: Record<string, string> = {
  DAYS_14: "14 dagen",
  DAYS_30: "30 dagen",
  PREPAYMENT: "Vooruitbetaling",
  INSTALLMENTS: "Termijnen",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verzonden",
  PARTIALLY_PAID: "Deels betaald",
  PAID: "Betaald",
  OVERDUE: "Verlopen",
  CREDITED: "Gecrediteerd",
};

export default async function RecurringInvoiceDetailPage({ params }: Params) {
  const { id } = await params;
  const { recurring, generatedInvoices } = await getData(id);

  if (!recurring) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title={recurring.description}
        description={`${recurring.customer.companyName} · ${FREQUENCY_LABELS[recurring.frequency] ?? recurring.frequency}`}
      />
      <div className="px-8 py-6 space-y-6">
        {/* Edit form + controls */}
        <RecurringInvoiceDetailClient
          recurring={{
            id: recurring.id,
            description: recurring.description,
            frequency: recurring.frequency,
            nextRunDate: recurring.nextRunDate.toISOString(),
            endDate: recurring.endDate?.toISOString() ?? null,
            isActive: recurring.isActive,
            paymentTermType: recurring.paymentTermType,
            language: recurring.language,
            customerId: recurring.customerId,
            customerName: recurring.customer.companyName,
            lines: recurring.lines.map((l) => ({
              id: l.id,
              skuSnapshot: l.skuSnapshot,
              titleSnapshot: l.titleSnapshot,
              qty: Number(l.qty),
              unitPrice: Number(l.unitPrice),
              vatRate: Number(l.vatRate),
              sortOrder: l.sortOrder,
            })),
          }}
        />

        {/* Meta info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Details</h3>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Klant</dt>
              <dd className="text-slate-900">{recurring.customer.companyName}</dd>
            </div>
            {recurring.contact && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Contactpersoon</dt>
                <dd className="text-slate-900">{recurring.contact.firstName} {recurring.contact.lastName}</dd>
              </div>
            )}
            {recurring.deal && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Deal</dt>
                <dd>
                  <Link href={`/deals/${recurring.deal.id}`} className="text-blue-600 hover:underline">
                    {recurring.deal.dealNumber}
                  </Link>
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Frequentie</dt>
              <dd className="text-slate-900">{FREQUENCY_LABELS[recurring.frequency] ?? recurring.frequency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Betalingstermijn</dt>
              <dd className="text-slate-900">{PAYMENT_TERM_LABELS[recurring.paymentTermType] ?? recurring.paymentTermType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Volgende uitvoering</dt>
              <dd className="text-slate-900">{formatDate(recurring.nextRunDate)}</dd>
            </div>
            {recurring.endDate && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Einddatum</dt>
                <dd className="text-slate-900">{formatDate(recurring.endDate)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Taal</dt>
              <dd className="text-slate-900">{recurring.language}</dd>
            </div>
          </dl>
        </div>

        {/* Lines */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Regelsjabloon</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Omschrijving</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aantal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stukprijs</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">BTW%</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totaal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recurring.lines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{line.skuSnapshot || "—"}</td>
                  <td className="px-4 py-3 text-slate-900">{line.titleSnapshot}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{Number(line.qty)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(Number(line.unitPrice))}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{Number(line.vatRate)}%</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(Number(line.qty) * Number(line.unitPrice))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Generated invoices */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">
              Gegenereerde facturen
              <span className="ml-2 text-slate-400 font-normal">({generatedInvoices.length})</span>
            </h3>
          </div>
          {generatedInvoices.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              Nog geen facturen gegenereerd
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nummer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vervaldatum</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totaal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {generatedInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium">
                      <Link href={`/invoices/${inv.id}/lines`} className="text-blue-600 hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(Number(inv.total))}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
