import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";

async function getDeals() {
  return prisma.deal.findMany({
    include: {
      customer: { select: { companyName: true } },
      lines: { select: { netLineTotal: true, expectedMarginTotal: true } },
      _count: { select: { quotes: true, invoices: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function DealsPage() {
  const deals = await getDeals();

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Deals"
        description={`${deals.length} deals`}
        actions={
          <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Nieuwe deal
          </button>
        }
      />

      <div className="px-8 py-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Deal</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Klant</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Omzet</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Marge</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Offertes</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Facturen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Nog geen deals aangemaakt
                  </td>
                </tr>
              )}
              {deals.map((deal) => {
                const omzet = deal.lines.reduce((s, l) => s + Number(l.netLineTotal), 0);
                const marge = deal.lines.reduce((s, l) => s + Number(l.expectedMarginTotal), 0);
                const margePct = omzet > 0 ? (marge / omzet) * 100 : 0;

                return (
                  <tr key={deal.id} className="hover:bg-slate-50 cursor-pointer transition-colors group relative">
                    <td className="px-4 py-3">
                      {/* Stretched link covers the full row */}
                      <Link href={`/deals/${deal.id}/products`} className="absolute inset-0" aria-label={deal.title} />
                      <div className="font-medium text-slate-900 group-hover:text-blue-700 transition-colors">{deal.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{deal.dealNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{deal.customer.companyName}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(omzet)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={margePct >= 30 ? "text-green-700 font-medium" : margePct >= 15 ? "text-slate-700" : "text-red-600 font-medium"}>
                        {formatCurrency(marge)}
                      </span>
                      <div className="text-xs text-slate-400">{margePct.toFixed(1)}%</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={deal.status} type="deal" />
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">{deal._count.quotes}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{deal._count.invoices}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
