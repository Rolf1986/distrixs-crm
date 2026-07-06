"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

type Customer = {
  id: string;
  customerNumber: string;
  companyName: string;
  kvkNumber: string | null;
  vatNumber: string | null;
  status: string;
  dealCount: number;
  contactCount: number;
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actief",
  INACTIVE: "Inactief",
  PROSPECT: "Prospect",
  BLOCKED: "Geblokkeerd",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  PROSPECT: "bg-brand-blue-light text-brand-blue",
  BLOCKED: "bg-red-100 text-red-600",
};

const STATUS_FILTERS = [
  { key: "all",      label: "Alle" },
  { key: "ACTIVE",   label: "Actief" },
  { key: "PROSPECT", label: "Prospect" },
  { key: "INACTIVE", label: "Inactief" },
];

const PAGE_SIZES = [30, 60, 100];

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const filtered = customers.filter((c) => {
    const matchesFilter = filter === "all" || c.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      c.companyName.toLowerCase().includes(q) ||
      c.customerNumber.toLowerCase().includes(q) ||
      (c.kvkNumber ?? "").toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => {
            const count = f.key === "all" ? customers.length : customers.filter((c) => c.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setPage(1); }}
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Zoeken op naam, nummer, KvK…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bedrijfsnaam</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nr.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">KvK</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">BTW</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deals</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contacten</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <p className="text-3xl mb-2">🏢</p>
                  <p className="text-slate-500 font-medium">Geen klanten gevonden</p>
                  <p className="text-xs text-slate-400 mt-1">Pas het filter of de zoekopdracht aan</p>
                </td>
              </tr>
            )}
            {paginated.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer group relative">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/customers/${c.id}`} className="absolute inset-0" />
                  <span className="group-hover:text-brand-blue transition-colors">{c.companyName}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{c.customerNumber}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.kvkNumber ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.vatNumber ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-right text-slate-600">{c.dealCount}</td>
                <td className="px-4 py-3 text-right text-slate-600">{c.contactCount}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status] ?? "bg-slate-100 text-slate-500"}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginering */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Per pagina:</span>
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => { setPageSize(size); setPage(1); }}
              className={`px-2 py-1 rounded ${
                pageSize === size ? "bg-brand-blue text-white" : "bg-white border border-slate-200 hover:border-slate-300"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span>
            {filtered.length === 0 ? "0" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)}`} van {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:border-slate-300"
            >
              Vorige
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:border-slate-300"
            >
              Volgende
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
