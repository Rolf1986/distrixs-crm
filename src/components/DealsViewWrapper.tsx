"use client";

import { RowLink } from "@/components/RowLink";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { LayoutList, LayoutGrid, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { DealKanbanView, type SerializedDeal } from "@/components/DealKanbanView";

const PAGE_SIZES = [30, 60, 100];

function formatShortDate(dateStr: string | null): React.ReactNode {
  if (!dateStr) return <span className="text-slate-300">—</span>;
  const date = new Date(dateStr);
  const isOverdue = date < new Date();
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
  }).format(date);
  return (
    <span className={isOverdue ? "text-orange-600 font-medium" : "text-slate-500"}>
      {fmt}
      {isOverdue && " ⚠"}
    </span>
  );
}

function ActivityDot({ hasOverdue, hasOpen }: { hasOverdue: boolean; hasOpen: boolean }) {
  if (!hasOpen && !hasOverdue)
    return (
      <span
        className="w-2 h-2 rounded-full bg-slate-200 inline-block"
        title="Geen openstaande activiteiten"
      />
    );
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full inline-block ${hasOverdue ? "bg-red-500" : "bg-blue-400"}`}
      title={hasOverdue ? "Activiteit over datum" : "Openstaande activiteit"}
    />
  );
}

type View = "list" | "kanban";

export function DealsViewWrapper({ deals }: { deals: SerializedDeal[] }) {
  const [view, setView] = useState<View>("list");
  const [sortDesc, setSortDesc] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // Persist view choice
  useEffect(() => {
    const saved = localStorage.getItem("deals-view") as View | null;
    if (saved === "kanban" || saved === "list") setView(saved);
  }, []);

  function switchView(v: View) {
    setView(v);
    localStorage.setItem("deals-view", v);
  }

  const filtered = deals.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.dealNumber.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.customer.companyName.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    if (da !== db) return sortDesc ? db - da : da - db;
    // Tiebreaker: numeriek deel van dealNumber (hogere nummer = nieuwere deal)
    const getNum = (s: string) => parseInt(s.split("-").pop() ?? "0") || 0;
    const na = getNum(a.dealNumber ?? "");
    const nb = getNum(b.dealNumber ?? "");
    return sortDesc ? nb - na : na - nb;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          {view === "list" && (
            <button
              onClick={() => { setSortDesc(!sortDesc); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-slate-300 transition-colors"
            >
              {sortDesc ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
              {sortDesc ? "Nieuwste eerst" : "Oudste eerst"}
            </button>
          )}
          <input
            type="text"
            placeholder="Zoeken…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 w-48"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => switchView("list")}
            className={`p-1.5 rounded transition-colors ${
              view === "list"
                ? "bg-brand-blue text-white"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            }`}
            title="Lijstweergave"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => switchView("kanban")}
            className={`p-1.5 rounded transition-colors ${
              view === "kanban"
                ? "bg-brand-blue text-white"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            }`}
            title="Kanban"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban view */}
      {view === "kanban" && <DealKanbanView deals={deals} />}

      {/* List view */}
      {view === "list" && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide w-8" title="Activiteit" />
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Nummer</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Titel</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Klant</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Omzet</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Gefactureerd</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Sluitdatum</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Fase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <p className="text-3xl mb-2">🤝</p>
                      <p className="text-slate-500 font-medium">Nog geen deals aangemaakt</p>
                      <p className="text-xs text-slate-400 mt-1">Maak een deal aan via de knop rechtsboven</p>
                    </td>
                  </tr>
                )}
                {paginated.map((d) => (
                  <tr
                    key={d.id}
                    className={`border-l-4 ${
                      d.status === "WON"
                        ? "border-l-green-500"
                        : d.status === "LOST"
                        ? "border-l-red-400"
                        : d.status === "QUOTE_SENT"
                        ? "border-l-brand-blue"
                        : "border-l-slate-200"
                    } hover:bg-slate-50 cursor-pointer transition-colors group relative`}
                  >
                    <td className="px-4 py-3 text-center">
                      <RowLink href={`/deals/${d.id}/quotes`} />
                      <ActivityDot hasOverdue={d.hasOverdueActivity} hasOpen={d.hasOpenActivity} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-900 font-medium group-hover:text-brand-blue transition-colors">
                        {d.dealNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{d.title}</td>
                    <td className="px-4 py-3 text-slate-600">{d.customer.companyName}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(d.omzet)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${d.gefactureerd ? "text-green-700" : "text-slate-400"}`}>
                        {d.gefactureerd ? "Ja" : "Nee"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatShortDate(d.expectedCloseDate)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} type="deal" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-slate-600 mt-4">
            <div className="flex items-center gap-2">
              <span>Per pagina:</span>
              {PAGE_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setPageSize(s); setPage(1); }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    pageSize === s
                      ? "bg-brand-blue text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {sorted.length === 0 ? "0" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)}`} van {sorted.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-1.5 rounded border border-slate-200 text-slate-500 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs">{safePage} / {Math.max(1, totalPages)}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-1.5 rounded border border-slate-200 text-slate-500 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
