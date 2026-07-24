import { notFound } from "next/navigation";
import { RowLink } from "@/components/RowLink";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_ORDER = ["ACCEPTED", "SENT", "DRAFT", "REJECTED"];

async function getCustomerQuotes(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return null;

  return prisma.quote.findMany({
    where: { customerId },
    include: {
      deal: { select: { id: true, dealNumber: true } },
      _count: { select: { invoices: true } },
    },
    orderBy: { quoteDate: "desc" },
  });
}

export default async function CustomerQuotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quotes = await getCustomerQuotes(id);
  if (!quotes) notFound();

  // Group by status order
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: quotes.filter((q) => q.status === status),
  })).filter((g) => g.items.length > 0);

  // Any status not in STATUS_ORDER
  const knownStatuses = new Set(STATUS_ORDER);
  const otherItems = quotes.filter((q) => !knownStatuses.has(q.status));
  if (otherItems.length > 0) grouped.push({ status: "OTHER", items: otherItems });

  const STATUS_LABEL: Record<string, string> = {
    ACCEPTED: "Aanvaard",
    SENT: "Verzonden",
    DRAFT: "Concept",
    REJECTED: "Afgewezen",
    OTHER: "Overig",
  };

  return (
    <div className="space-y-6">
      {quotes.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-10 text-center text-slate-400">
          Nog geen offertes voor deze klant
        </div>
      )}
      {grouped.map(({ status, items }) => (
        <div key={status}>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
            {STATUS_LABEL[status] ?? status} ({items.length})
          </h3>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nummer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Geldig t/m</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totaal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Gefactureerd</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((q) => {
                  const isExpired = q.validUntil && new Date(q.validUntil) < new Date() && q.status !== "ACCEPTED";
                  return (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors cursor-pointer relative">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">
                        <RowLink href={`/quotes/${q.id}/lines`} />
                        {q.quoteNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {q.deal
                          ? <Link href={`/deals/${q.deal.id}/quotes`} className="relative hover:text-brand-blue z-10">{q.deal.dealNumber}</Link>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(q.quoteDate)}</td>
                      <td className={`px-4 py-3 text-sm ${isExpired ? "text-orange-600 font-medium" : "text-slate-500"}`}>
                        {q.validUntil ? formatDate(q.validUntil) : <span className="text-slate-300">—</span>}
                        {isExpired && <span className="ml-1">⚠</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(Number(q.total))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${q._count.invoices > 0 ? "text-green-700" : "text-slate-400"}`}>
                          {q._count.invoices > 0 ? "Ja" : "Nee"}
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
      ))}
    </div>
  );
}
