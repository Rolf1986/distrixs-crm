"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

type Invoice = {
  id: string;
  invoiceNumber: string;
  ourReference: string | null;
  customerName: string;
  dealNumber: string | null;
  invoiceDate: string;
  dueDate: string;
  total: number;
  openAmount: number;
  status: string;
};

const STATUS_FILTERS = [
  { key: "all",         label: "Alle" },
  { key: "unpaid",      label: "Niet betaald" },
  { key: "overdue",     label: "Verlopen" },
  { key: "DRAFT",       label: "Concept" },
  { key: "SENT",        label: "Verzonden" },
  { key: "PARTIALLY_PAID", label: "Deels betaald" },
  { key: "PAID",        label: "Betaald" },
];

function daysOverdue(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - due.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function InvoicesClient({ invoices }: { invoices: Invoice[] }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = invoices.filter((inv) => {
    const invDue = new Date(inv.dueDate);
    invDue.setHours(0, 0, 0, 0);
    const isOverdue = inv.status !== "PAID" && inv.status !== "CREDITED" && inv.status !== "DRAFT" && invDue < today;

    const matchesFilter =
      filter === "all" ||
      (filter === "unpaid" && inv.status !== "PAID" && inv.status !== "CREDITED") ||
      (filter === "overdue" && isOverdue) ||
      inv.status === filter;

    const matchesSearch =
      !search ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (inv.dealNumber ?? "").toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Summary for current filter
  const totalOpen = filtered
    .filter((inv) => inv.status !== "PAID" && inv.status !== "CREDITED")
    .reduce((s, inv) => s + inv.openAmount, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count = f.key === "all"
              ? invoices.length
              : f.key === "unpaid"
              ? invoices.filter((i) => i.status !== "PAID" && i.status !== "CREDITED").length
              : f.key === "overdue"
              ? invoices.filter((i) => {
                  const d = new Date(i.dueDate); d.setHours(0,0,0,0);
                  return i.status !== "PAID" && i.status !== "CREDITED" && i.status !== "DRAFT" && d < today;
                }).length
              : invoices.filter((i) => i.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
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
        <input
          type="text"
          placeholder="Zoeken…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 w-48"
        />
      </div>

      {/* Open amount summary */}
      {filter !== "all" && filter !== "PAID" && totalOpen > 0 && (
        <div className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <span className="font-semibold text-amber-800">{formatCurrency(totalOpen)}</span>
          <span className="text-amber-700"> openstaand in deze selectie</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nummer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Klant</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deal</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vervaldatum</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totaal</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Open</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Geen facturen gevonden
                </td>
              </tr>
            )}
            {filtered.map((inv) => {
              const invDue = new Date(inv.dueDate);
              invDue.setHours(0, 0, 0, 0);
              const isOverdue = inv.status !== "PAID" && inv.status !== "CREDITED" && inv.status !== "DRAFT" && invDue < today;
              const overduedays = isOverdue ? daysOverdue(inv.dueDate) : 0;
              return (
                <tr
                  key={inv.id}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer group relative ${
                    isOverdue ? "bg-red-50/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-medium text-slate-900">
                    <Link href={`/invoices/${inv.id}/lines`} className="absolute inset-0" />
                    <span className="group-hover:text-brand-blue transition-colors">{inv.invoiceNumber}</span>
                    {inv.ourReference && (
                      <span className="block text-xs text-slate-400 font-normal">{inv.ourReference}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{inv.customerName}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{inv.dealNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3">
                    <span className={isOverdue ? "text-red-600 font-medium" : "text-slate-500"}>
                      {formatDate(inv.dueDate)}
                    </span>
                    {isOverdue && overduedays > 0 && (
                      <span className="ml-1.5 text-xs text-red-500 font-medium">+{overduedays}d</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(inv.total)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${inv.openAmount > 0 ? (isOverdue ? "text-red-600" : "text-slate-700") : "text-slate-300"}`}>
                    {formatCurrency(inv.openAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} type="invoice" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
