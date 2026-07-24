import { prisma } from "@/lib/prisma";
import { RowLink } from "@/components/RowLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileText } from "lucide-react";
import { CreateQuoteButton } from "@/components/CreateQuoteButton";

async function getDealQuotes(dealId: string) {
  return prisma.quote.findMany({
    where: { dealId },
    include: {
      lines: { select: { expectedMarginSnapshot: true } },
      _count: { select: { invoices: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

const STATUS_ORDER = ["ACCEPTED", "SENT", "DRAFT", "REJECTED"];
const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "Aanvaard",
  SENT: "Verzonden",
  DRAFT: "Concept",
  REJECTED: "Afgewezen",
};

export default async function DealQuotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotes = await getDealQuotes(id);

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: quotes.filter((q) => q.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Offertes ({quotes.length})
        </h2>
        <CreateQuoteButton dealId={id} />
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-medium">Nog geen offertes</p>
          <p className="text-slate-400 text-xs mt-1">
            Gebruik de knop &ldquo;Offerte maken&rdquo; bovenaan om een offerte aan te maken vanuit de dealregels.
          </p>
        </div>
      ) : (
        grouped.map(({ status, items }) => (
          <div key={status}>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              {STATUS_LABEL[status] ?? status} ({items.length})
            </h3>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Nummer</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Datum</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Geldig t/m</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Totaal incl. BTW</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Marge</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Gefact.</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((q) => {
                    const marge = q.lines.reduce((s, l) => s + Number(l.expectedMarginSnapshot), 0);
                    const margePct = Number(q.subtotal) > 0 ? (marge / Number(q.subtotal)) * 100 : 0;
                    const gefactureerd = q._count.invoices > 0;
                    const isExpired =
                      q.validUntil &&
                      new Date(q.validUntil) < new Date() &&
                      q.status !== "ACCEPTED";
                    return (
                      <tr key={q.id} className="hover:bg-slate-50 cursor-pointer transition-colors group relative">
                        <td className="px-4 py-3">
                          <RowLink href={`/quotes/${q.id}/lines`} />
                          <span className="font-medium font-mono text-slate-900 group-hover:text-brand-blue transition-colors">
                            {q.quoteNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(q.quoteDate)}</td>
                        <td className={`px-4 py-3 text-sm ${isExpired ? "text-orange-600 font-medium" : "text-slate-500"}`}>
                          {q.validUntil
                            ? <>{formatDate(q.validUntil)}{isExpired && <span className="ml-1 text-xs">⚠</span>}</>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(Number(q.total))}</td>
                        <td className="px-4 py-3 text-right">
                          {marge > 0 ? (
                            <span className="text-green-700 font-medium text-xs">
                              {formatCurrency(marge)} ({margePct.toFixed(0)}%)
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-medium ${gefactureerd ? "text-green-700" : "text-slate-300"}`}>
                            {gefactureerd ? "✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={q.status} type="quote" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
