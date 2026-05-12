import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChevronLeft } from "lucide-react";

const OPEN_STATUSES = ["NEW", "CONTACTED", "MEETING_PLANNED", "QUOTE_SENT"];

async function getForecastData() {
  const deals = await prisma.deal.findMany({
    where: { status: { in: OPEN_STATUSES } },
    include: {
      customer: { select: { companyName: true } },
      quotes: {
        where: { status: { not: "REJECTED" } },
        select: { total: true },
      },
    },
    orderBy: { expectedCloseDate: "asc" },
  });

  return deals.map((d) => ({
    id: d.id,
    dealNumber: d.dealNumber,
    title: d.title,
    status: d.status,
    customer: d.customer.companyName,
    omzet: d.quotes.reduce((s, q) => s + Number(q.total), 0),
    winProbability: d.winProbability,
    expectedCloseDate: d.expectedCloseDate,
  }));
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(
    new Date(Number(year), Number(month) - 1, 1)
  );
}

function isCurrentOrFuture(key: string): boolean {
  const now = monthKey(new Date());
  return key >= now;
}

export default async function ForecastPage() {
  const deals = await getForecastData();

  // Split: no close date vs has close date
  const noDate = deals.filter((d) => !d.expectedCloseDate);
  const withDate = deals.filter((d) => !!d.expectedCloseDate);

  // Group by month
  const byMonth = new Map<string, typeof withDate>();
  for (const deal of withDate) {
    const key = monthKey(deal.expectedCloseDate!);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(deal);
  }

  // Sort months chronologically
  const months = Array.from(byMonth.keys()).sort();

  // Past months (already closed this month counted separately)
  const now = monthKey(new Date());
  const pastMonths = months.filter((m) => m < now);
  const currentAndFuture = months.filter((m) => m >= now);

  // Total stats
  const totalPipeline = withDate.reduce((s, d) => s + d.omzet, 0);
  const totalWeighted = withDate.reduce(
    (s, d) => s + d.omzet * ((d.winProbability ?? 50) / 100),
    0
  );

  function MonthGroup({ monthKey: key }: { monthKey: string }) {
    const monthDeals = byMonth.get(key) ?? [];
    const monthTotal = monthDeals.reduce((s, d) => s + d.omzet, 0);
    const monthWeighted = monthDeals.reduce(
      (s, d) => s + d.omzet * ((d.winProbability ?? 50) / 100),
      0
    );
    const isPast = key < now;
    return (
      <div className={`rounded-xl border overflow-hidden ${isPast ? "opacity-60" : ""}`}>
        {/* Month header */}
        <div className={`px-4 py-3 border-b flex items-center justify-between ${
          isPast ? "bg-slate-50 border-slate-200" : "bg-brand-blue-light border-brand-blue/20"
        }`}>
          <div>
            <span className={`font-semibold text-sm capitalize ${isPast ? "text-slate-500" : "text-slate-800"}`}>
              {monthLabel(key)}
            </span>
            {isPast && (
              <span className="ml-2 text-xs text-slate-400 font-normal">(verstreken)</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-xs text-slate-500">Pipeline</p>
              <p className="text-sm font-semibold text-slate-900">{formatCurrency(monthTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Gewogen</p>
              <p className={`text-sm font-semibold ${isPast ? "text-slate-600" : "text-brand-blue"}`}>
                {formatCurrency(monthWeighted)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 px-2.5 py-1 text-center min-w-[2.5rem]">
              <p className="text-xs font-semibold text-slate-700">{monthDeals.length}</p>
              <p className="text-xs text-slate-400">deal{monthDeals.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
        {/* Deals */}
        <div className="bg-white divide-y divide-slate-50">
          {monthDeals.map((d) => (
            <Link
              key={d.id}
              href={`/deals/${d.id}/quotes`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-slate-400 shrink-0">{d.dealNumber}</span>
                <span className="text-sm font-medium text-slate-800 group-hover:text-brand-blue truncate">
                  {d.title}
                </span>
                <span className="text-xs text-slate-400 truncate hidden sm:inline">{d.customer}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {d.winProbability !== null && (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                    {d.winProbability}%
                  </span>
                )}
                <span className="text-sm font-semibold text-slate-900 min-w-[80px] text-right">
                  {formatCurrency(d.omzet)}
                </span>
                <StatusBadge status={d.status} type="deal" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="px-8 pt-6 pb-0 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
          <Link href="/deals" className="hover:text-slate-600 transition-colors flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" />
            Deals
          </Link>
        </div>
        <div className="flex items-end justify-between pb-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Pipeline forecast</h1>
            <p className="text-sm text-slate-500 mt-1">
              {withDate.length} deals met sluitdatum · {noDate.length} zonder datum
            </p>
          </div>
          {/* Summary KPIs */}
          <div className="flex items-center gap-4 pb-1">
            <div className="text-right">
              <p className="text-xs text-slate-500">Totaal pipeline</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(totalPipeline)}</p>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="text-right">
              <p className="text-xs text-slate-500">Gewogen</p>
              <p className="text-lg font-bold text-brand-blue">{formatCurrency(totalWeighted)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        {/* No close date section */}
        {noDate.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Geen sluitdatum ({noDate.length})
            </h3>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50 overflow-hidden">
              {noDate.map((d) => (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}/quotes`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-slate-400 shrink-0">{d.dealNumber}</span>
                    <span className="text-sm font-medium text-slate-800 group-hover:text-brand-blue truncate">
                      {d.title}
                    </span>
                    <span className="text-xs text-slate-400 truncate hidden sm:inline">{d.customer}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {d.winProbability !== null && (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                        {d.winProbability}%
                      </span>
                    )}
                    <span className="text-sm font-semibold text-slate-900 min-w-[80px] text-right">
                      {formatCurrency(d.omzet)}
                    </span>
                    <StatusBadge status={d.status} type="deal" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Past months (collapsed feel) */}
        {pastMonths.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Verstreken maanden
            </h3>
            <div className="space-y-3">
              {pastMonths.map((key) => (
                <MonthGroup key={key} monthKey={key} />
              ))}
            </div>
          </div>
        )}

        {/* Current and future months */}
        {currentAndFuture.length > 0 && (
          <div>
            {pastMonths.length > 0 && (
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Komende maanden
              </h3>
            )}
            <div className="space-y-3">
              {currentAndFuture.map((key) => (
                <MonthGroup key={key} monthKey={key} />
              ))}
            </div>
          </div>
        )}

        {deals.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center text-slate-400">
            Geen open deals in de pipeline
          </div>
        )}
      </div>
    </div>
  );
}
