import { notFound } from "next/navigation";
import { RowLink } from "@/components/RowLink";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils";

const OPEN_STATUSES = ["NEW", "CONTACTED", "MEETING_PLANNED", "QUOTE_SENT"];

async function getCustomerDeals(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return null;

  return prisma.deal.findMany({
    where: { customerId },
    include: {
      quotes: {
        where: { status: { not: "REJECTED" } },
        select: { total: true },
      },
      _count: { select: { quotes: true, invoices: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

function DealTable({
  deals,
}: {
  deals: Awaited<ReturnType<typeof getCustomerDeals>>;
}) {
  if (!deals || deals.length === 0)
    return (
      <p className="text-sm text-slate-400 py-2 px-1">Geen deals in deze categorie.</p>
    );
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nummer</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Titel</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Omzet</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Offertes</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Facturen</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {deals.map((deal) => {
            const omzet = deal.quotes.reduce((s, q) => s + Number(q.total), 0);
            return (
              <tr key={deal.id} className="hover:bg-slate-50 transition-colors relative">
                <td className="px-4 py-3 font-mono text-xs text-slate-500 relative">
                  <RowLink href={`/deals/${deal.id}/quotes`} />
                  {deal.dealNumber}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{deal.title}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(omzet)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{deal._count.quotes}</td>
                <td className="px-4 py-3 text-right text-slate-600">{deal._count.invoices}</td>
                <td className="px-4 py-3"><StatusBadge status={deal.status} type="deal" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function CustomerDealsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deals = await getCustomerDeals(id);
  if (!deals) notFound();

  const openDeals = deals.filter((d) => OPEN_STATUSES.includes(d.status));
  const wonDeals = deals.filter((d) => d.status === "WON");
  const lostDeals = deals.filter((d) => d.status === "LOST");

  const totalOpen = openDeals.reduce(
    (s, d) => s + d.quotes.reduce((qs, q) => qs + Number(q.total), 0),
    0
  );
  const totalWon = wonDeals.reduce(
    (s, d) => s + d.quotes.reduce((qs, q) => qs + Number(q.total), 0),
    0
  );

  return (
    <div className="space-y-8">
      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        <div className="text-sm bg-brand-blue-light border border-brand-blue/20 rounded-lg px-4 py-2">
          <span className="text-brand-blue font-medium">Open</span>{" "}
          <span className="text-brand-blue-dark font-semibold">{openDeals.length}</span>
          {totalOpen > 0 && (
            <span className="ml-2 text-brand-blue">{formatCurrency(totalOpen)}</span>
          )}
        </div>
        <div className="text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <span className="text-green-600 font-medium">Gewonnen</span>{" "}
          <span className="text-green-800 font-semibold">{wonDeals.length}</span>
          {totalWon > 0 && (
            <span className="ml-2 text-green-600">{formatCurrency(totalWon)}</span>
          )}
        </div>
        <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
          <span className="text-slate-500 font-medium">Verloren</span>{" "}
          <span className="text-slate-700 font-semibold">{lostDeals.length}</span>
        </div>
      </div>

      {deals.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-10 text-center text-slate-400">
          Nog geen deals voor deze klant
        </div>
      )}

      {openDeals.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
            Open ({openDeals.length}) · {formatCurrency(totalOpen)}
          </h3>
          <DealTable deals={openDeals} />
        </section>
      )}

      {wonDeals.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
            Gewonnen ({wonDeals.length}) · {formatCurrency(totalWon)}
          </h3>
          <DealTable deals={wonDeals} />
        </section>
      )}

      {lostDeals.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
            Verloren ({lostDeals.length})
          </h3>
          <DealTable deals={lostDeals} />
        </section>
      )}
    </div>
  );
}
