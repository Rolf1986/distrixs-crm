"use client";

import { RowLink } from "@/components/RowLink";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

type Quote = {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  dealId: string | null;
  dealNumber: string | null;
  quoteDate: string;
  validUntil: string | null;
  subtotal: number;
  total: number;
  margin: number;
  gefactureerd: boolean;
  status: string;
};

function isExpiredQuote(q: Quote, today: Date) {
  return (
    q.validUntil &&
    new Date(q.validUntil) < today &&
    q.status !== "ACCEPTED" &&
    q.status !== "REJECTED"
  );
}

const STATUS_FILTERS = [
  { key: "all",      label: "Alle" },
  { key: "DRAFT",    label: "Concept" },
  { key: "SENT",     label: "Verzonden" },
  { key: "ACCEPTED", label: "Aanvaard" },
  { key: "REJECTED", label: "Afgewezen" },
  { key: "EXPIRED",  label: "Verlopen" },
];

const PAGE_SIZES = [30, 60, 100];

export function QuotesClient({ quotes }: { quotes: Quote[] }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const today = new Date();

  const filtered = quotes
    .filter((q) => {
      const matchesSearch =
        !search ||
        q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
        q.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (q.dealNumber ?? "").toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (filter === "all") return true;
      if (filter === "EXPIRED") return !!isExpiredQuote(q, today);
      return q.status === filter;
    })
    .sort((a, b) => {
      // Sorteer op het numerieke deel van het offertenummer (hoogste = nieuwste TL-offerte)
      const getNum = (s: string) => {
        const parts = s.split("-");
        return parseInt(parts[parts.length - 1]) || 0;
      };
      const na = getNum(a.quoteNumber);
      const nb = getNum(b.quoteNumber);
      return sortDesc ? nb - na : na - nb;
    });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleFilterChange(key: string) {
    setFilter(key);
    setPage(1);
  }

  function countFor(key: string) {
    if (key === "all") return quotes.length;
    if (key === "EXPIRED") return quotes.filter((q) => isExpiredQuote(q, today)).length;
    return quotes.filter((q) => q.status === key).length;
  }

  const sentTotal = filtered
    .filter((q) => q.status === "SENT" || q.status === "ACCEPTED")
    .reduce((s, q) => s + q.total, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count = countFor(f.key);
            return (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "bg-brand-blue text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {f.label}
                {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSortDesc(!sortDesc); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-slate-300 transition-colors"
          >
            {sortDesc ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
            {sortDesc ? "Hoogste nr eerst" : "Laagste nr eerst"}
          </button>
          <input
            type="text"
            placeholder="Zoeken…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 w-48"
          />
        </div>
      </div>

      {/* Openstaand banner */}
      {(filter === "SENT" || filter === "ACCEPTED" || filter === "all") && sentTotal > 0 && (
        <div className="text-sm text-slate-600 bg-brand-blue-light border border-brand-blue/20 rounded-lg px-4 py-2.5">
          <span className="font-semibold text-brand-blue-dark">{formatCurrency(sentTotal)}</span>
          <span className="text-brand-blue"> in openstaande offertes</span>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Nummer</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Klant</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Deal</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Datum</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Geldig t/m</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Totaal</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Marge</th>
              <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Gefact.</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center">
                  <p className="text-3xl mb-2">📄</p>
                  <p className="text-slate-500 font-medium">Geen offertes gevonden</p>
                  <p className="text-xs text-slate-400 mt-1">Pas het filter of de zoekopdracht aan</p>
                </td>
              </tr>
            )}
            {paginated.map((q) => {
              const margePct = q.subtotal > 0 ? (q.margin / q.subtotal) * 100 : 0;
              const expired = isExpiredQuote(q, today);
              const accentBar = expired && q.status === "SENT"
                ? "border-l-orange-500"
                : q.status === "ACCEPTED"
                ? "border-l-green-500"
                : q.status === "REJECTED"
                ? "border-l-red-400"
                : q.status === "SENT"
                ? "border-l-brand-blue"
                : "border-l-slate-200";
              return (
                <tr key={q.id} className={`border-l-4 ${accentBar} hover:bg-slate-50 cursor-pointer transition-colors group relative`}>
                  <td className="px-4 py-3">
                    <RowLink href={`/quotes/${q.id}/lines`} />
                    <span className="font-medium text-slate-900 group-hover:text-brand-blue transition-colors font-mono">
                      {q.quoteNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${q.customerId}`}
                      className="relative z-10 text-slate-600 hover:text-brand-blue hover:underline"
                    >
                      {q.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {q.dealId ? (
                      <Link
                        href={`/deals/${q.dealId}`}
                        className="relative z-10 text-slate-500 hover:text-brand-blue hover:underline font-mono"
                      >
                        {q.dealNumber}
                      </Link>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(q.quoteDate)}</td>
                  <td className={`px-4 py-3 text-sm ${expired ? "text-orange-600 font-medium" : "text-slate-500"}`}>
                    {q.validUntil ? formatDate(q.validUntil) : <span className="text-slate-300">—</span>}
                    {expired && <span className="ml-1 text-xs">⚠</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(q.total)}</td>
                  <td className="px-4 py-3 text-right">
                    {q.margin > 0 ? (
                      <span className="text-green-700 font-medium">
                        {formatCurrency(q.margin)}{" "}
                        <span className="text-xs text-green-600">({margePct.toFixed(0)}%)</span>
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${q.gefactureerd ? "text-green-700" : "text-slate-300"}`}>
                      {q.gefactureerd ? "✓" : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {expired && q.status === "SENT" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        Verlopen
                      </span>
                    ) : (
                      <StatusBadge status={q.status} type="quote" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-600">
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
            {filtered.length === 0 ? "0" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)}`} van {filtered.length}
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
    </div>
  );
}
