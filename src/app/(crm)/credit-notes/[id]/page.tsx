import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { KpiCard } from "@/components/ui/KpiCard";
import { ChevronRight, Download } from "lucide-react";
import { SendCreditNoteButton } from "@/components/SendCreditNoteButton";
import { SettleCreditNoteButton } from "@/components/SettleCreditNoteButton";
import { RefundCreditNoteButton, CreditNoteTwinfieldButton } from "@/components/CreditNoteStatusButtons";

async function getCreditNote(id: string) {
  return prisma.creditNote.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          companyName: true,
          email: true,
          contacts: { where: { isActive: true, email: { not: null } }, select: { email: true }, orderBy: { isPrimary: "desc" } },
        },
      },
      invoice: { select: { id: true, invoiceNumber: true } },
      lines: { orderBy: { createdAt: "asc" } },
      createdByUser: { select: { name: true } },
    },
  });
}

export default async function CreditNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cn = await getCreditNote(id);
  if (!cn) notFound();

  // Al verrekend met de factuur? (betaling met vast referentieformaat)
  const settlement = await prisma.payment.findFirst({
    where: { invoiceId: cn.invoiceId, reference: `Verrekening ${cn.creditNoteNumber}` },
    select: { id: true },
  });

  // Group VAT for breakdown
  const vatGroups = new Map<number, { base: number; vat: number }>();
  for (const line of cn.lines) {
    const rate = Number(line.vatRate);
    const base = Number(line.lineTotal);
    const vat = Number(line.vatAmount);
    const existing = vatGroups.get(rate) ?? { base: 0, vat: 0 };
    vatGroups.set(rate, { base: existing.base + base, vat: existing.vat + vat });
  }
  const vatBreakdown = Array.from(vatGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, { base, vat }]) => ({ rate, base, vat }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/credit-notes" className="hover:text-slate-600 transition-colors">
          Creditnota&apos;s
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-600 font-medium font-mono">{cn.creditNoteNumber}</span>
      </div>

      {/* Header */}
      <div className="px-8 pt-3 pb-5 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900 font-mono">
                {cn.creditNoteNumber}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                Creditnota
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
              <Link
                href={`/customers/${cn.customer.id}`}
                className="text-brand-blue hover:underline"
              >
                {cn.customer.companyName}
              </Link>
              <span className="text-slate-400">· {formatDate(cn.creditNoteDate)}</span>
              <span className="text-slate-400">
                · Factuur:{" "}
                <Link
                  href={`/invoices/${cn.invoice.id}/lines`}
                  className="text-brand-blue hover:underline font-mono"
                >
                  {cn.invoice.invoiceNumber}
                </Link>
              </span>
              {cn.createdByUser && (
                <span className="text-slate-400">· Aangemaakt door {cn.createdByUser.name}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreditNoteTwinfieldButton
              creditNoteId={cn.id}
              syncStatus={cn.twinfieldSyncStatus as "NOT_SYNCED" | "PENDING" | "SYNCED" | "ERROR"}
              reference={cn.twinfieldReference ?? null}
            />
            {!settlement && <RefundCreditNoteButton creditNoteId={cn.id} refunded={!!cn.refundedAt} />}
            {!cn.refundedAt && <SettleCreditNoteButton creditNoteId={cn.id} settled={!!settlement} />}
            <a
              href={`/api/credit-notes/${cn.id}/pdf`}
              className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </a>
            <SendCreditNoteButton
              creditNoteId={cn.id}
              creditNoteNumber={cn.creditNoteNumber}
              defaultTo={cn.customer.email ?? cn.customer.contacts[0]?.email ?? ""}
              emailOptions={Array.from(new Set([
                cn.customer.email,
                ...cn.customer.contacts.map((c) => c.email),
              ].filter((e): e is string => !!e)))}
            />
          </div>
        </div>

        {/* KPI's */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <KpiCard label="Subtotaal excl. BTW" value={formatCurrency(Number(cn.subtotal))} />
          <KpiCard label="BTW" value={formatCurrency(Number(cn.vatAmount))} />
          <KpiCard label="Totaal creditnota" value={formatCurrency(Number(cn.total))} />
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 space-y-6">
        {/* Lines table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Creditnotaregels
            </h2>
            <span className="text-xs text-slate-400">
              {cn.lines.length} regel{cn.lines.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    SKU
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Omschrijving
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Aantal
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Eenheidsprijs
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    BTW %
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    BTW
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Regeltotaal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cn.lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Geen regels
                    </td>
                  </tr>
                )}
                {cn.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {line.skuSnapshot}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {line.titleSnapshot}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{Number(line.qty)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatCurrency(Number(line.unitPrice))}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{Number(line.vatRate)}%</td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {formatCurrency(Number(line.vatAmount))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(Number(line.lineTotal))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={5} className="px-4 py-2 text-right text-sm text-slate-500">
                    Subtotaal excl. BTW
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900">
                    {formatCurrency(Number(cn.subtotal))}
                  </td>
                  <td />
                </tr>
                {vatBreakdown.map((g) => (
                  <tr key={g.rate}>
                    <td colSpan={5} className="px-4 py-1.5 text-right text-sm text-slate-500">
                      BTW {g.rate}% over {formatCurrency(g.base)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-slate-700">
                      {formatCurrency(g.vat)}
                    </td>
                    <td />
                  </tr>
                ))}
                <tr className="border-t border-slate-200">
                  <td colSpan={5} className="px-4 py-3 text-right font-semibold text-slate-700">
                    Totaal creditnota
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">
                    {formatCurrency(Number(cn.total))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Meta info */}
        {cn.reason && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              Reden
            </h3>
            <p className="text-sm text-slate-700">{cn.reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
