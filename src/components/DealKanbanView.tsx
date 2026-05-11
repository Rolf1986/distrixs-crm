"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export interface SerializedDeal {
  id: string;
  dealNumber: string;
  title: string;
  status: string;
  customer: { companyName: string };
  omzet: number;
  gefactureerd: boolean;
  hasOverdueActivity: boolean;
  hasOpenActivity: boolean;
  expectedCloseDate: string | null;
  winProbability: number | null;
  createdAt: string;
}

const PIPELINE_STAGES: { key: string; label: string; color: string; dotColor: string }[] = [
  { key: "NEW",            label: "Nieuw",             color: "border-slate-300 bg-slate-50",   dotColor: "bg-slate-400" },
  { key: "CONTACTED",      label: "Contact",           color: "border-brand-blue/30 bg-brand-blue-light",     dotColor: "bg-brand-blue" },
  { key: "MEETING_PLANNED",label: "Afspraak gepland",  color: "border-violet-300 bg-violet-50", dotColor: "bg-violet-500" },
  { key: "QUOTE_SENT",     label: "Offerte verzonden", color: "border-amber-300 bg-amber-50",   dotColor: "bg-amber-500" },
];

const CLOSED_STAGES = [
  { key: "WON",  label: "Gewonnen", badgeClass: "bg-green-100 text-green-700 border border-green-200" },
  { key: "LOST", label: "Verloren", badgeClass: "bg-red-100 text-red-600 border border-red-200" },
];

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatShortDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(
    new Date(dateStr)
  );
}

function DealCard({ deal }: { deal: SerializedDeal }) {
  const closeOverdue = isOverdue(deal.expectedCloseDate);
  return (
    <Link
      href={`/deals/${deal.id}/quotes`}
      className="block bg-white rounded-lg border border-slate-200 p-3 hover:border-brand-blue/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-slate-900 leading-snug group-hover:text-brand-blue transition-colors line-clamp-2">
          {deal.title}
        </p>
        {(deal.hasOverdueActivity || deal.hasOpenActivity) && (
          <span
            className={`shrink-0 w-2 h-2 rounded-full mt-1 ${deal.hasOverdueActivity ? "bg-red-500" : "bg-blue-400"}`}
            title={deal.hasOverdueActivity ? "Activiteit over datum" : "Openstaande activiteit"}
          />
        )}
      </div>
      <p className="text-xs text-slate-500 mb-2">{deal.customer.companyName}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{formatCurrency(deal.omzet)}</span>
        {deal.winProbability !== null && (
          <span className="text-xs text-slate-500 font-medium bg-slate-100 rounded px-1.5 py-0.5">
            {deal.winProbability}%
          </span>
        )}
      </div>
      {deal.expectedCloseDate && (
        <p className={`text-xs mt-1.5 font-medium ${closeOverdue ? "text-red-500" : "text-slate-400"}`}>
          {closeOverdue ? "⚠ " : ""}Sluit {formatShortDate(deal.expectedCloseDate)}
        </p>
      )}
      {deal.gefactureerd && (
        <span className="mt-1.5 inline-block text-xs text-green-700 font-medium">✓ Gefactureerd</span>
      )}
    </Link>
  );
}

function KanbanColumn({
  stage,
  deals,
}: {
  stage: (typeof PIPELINE_STAGES)[number];
  deals: SerializedDeal[];
}) {
  const total = deals.reduce((s, d) => s + d.omzet, 0);
  return (
    <div className="flex flex-col min-w-0 w-full">
      {/* Column header */}
      <div className={`rounded-t-lg border-x border-t ${stage.color} px-3 py-2.5`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${stage.dotColor}`} />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide truncate">
            {stage.label}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-500">{deals.length} {deals.length === 1 ? "deal" : "deals"}</span>
          {deals.length > 0 && (
            <span className="text-xs font-semibold text-slate-700">{formatCurrency(total)}</span>
          )}
        </div>
      </div>
      {/* Cards */}
      <div className="flex-1 border-x border-b border-slate-200 rounded-b-lg bg-slate-100/60 p-2 space-y-2 min-h-[120px]">
        {deals.length === 0 && (
          <p className="text-xs text-slate-400 text-center pt-6 pb-4">Geen deals</p>
        )}
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} />
        ))}
      </div>
    </div>
  );
}

export function DealKanbanView({ deals }: { deals: SerializedDeal[] }) {
  const openDeals = PIPELINE_STAGES.map((stage) => ({
    stage,
    deals: deals.filter((d) => d.status === stage.key),
  }));

  const closedGroups = CLOSED_STAGES.map((s) => ({
    ...s,
    deals: deals.filter((d) => d.status === s.key),
  }));

  return (
    <div className="overflow-x-auto pb-4">
      {/* Open pipeline columns */}
      <div className="grid grid-cols-4 gap-3 min-w-[900px] mb-6">
        {openDeals.map(({ stage, deals: colDeals }) => (
          <KanbanColumn key={stage.key} stage={stage} deals={colDeals} />
        ))}
      </div>

      {/* Closed stages summary */}
      {closedGroups.some((g) => g.deals.length > 0) && (
        <div className="flex gap-3 flex-wrap">
          {closedGroups.map(
            (g) =>
              g.deals.length > 0 && (
                <div
                  key={g.key}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${g.badgeClass}`}
                >
                  <span className="font-medium">{g.label}</span>
                  <span className="font-semibold">{g.deals.length}</span>
                  <span className="opacity-70">
                    {formatCurrency(g.deals.reduce((s, d) => s + d.omzet, 0))}
                  </span>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
