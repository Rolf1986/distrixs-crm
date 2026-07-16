"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Eye, X, Loader2, FileText, Receipt, Bell, Undo2 } from "lucide-react";

type SentEmail = {
  id: string;
  category: string;
  toAddress: string;
  subject: string;
  relatedType: string | null;
  relatedId: string | null;
  relatedLabel: string | null;
  customerName: string | null;
  sentAt: string;
};

const CATEGORIES = [
  { key: "all", label: "Alle" },
  { key: "INVOICE", label: "Facturen" },
  { key: "REMINDER", label: "Herinneringen" },
  { key: "QUOTE", label: "Offertes" },
  { key: "CREDIT_NOTE", label: "Creditnota's" },
];

const CAT_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  INVOICE: { label: "Factuur", Icon: Receipt, color: "text-brand-blue bg-blue-50" },
  REMINDER: { label: "Herinnering", Icon: Bell, color: "text-orange-600 bg-orange-50" },
  QUOTE: { label: "Offerte", Icon: FileText, color: "text-violet-600 bg-violet-50" },
  CREDIT_NOTE: { label: "Creditnota", Icon: Undo2, color: "text-red-600 bg-red-50" },
  OTHER: { label: "Overig", Icon: Mail, color: "text-slate-500 bg-slate-100" },
};

function relatedHref(e: SentEmail): string | null {
  if (!e.relatedId) return null;
  if (e.relatedType === "Invoice") return `/invoices/${e.relatedId}/lines`;
  if (e.relatedType === "Quote") return `/quotes/${e.relatedId}/lines`;
  if (e.relatedType === "CreditNote") return `/credit-notes/${e.relatedId}`;
  return null;
}

function fmt(at: string): string {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(at));
}

export function SentEmailsClient({ emails }: { emails: SentEmail[] }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<{ subject: string; toAddress: string; ccAddress: string | null; sentAt: string; bodyHtml: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function view(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/sent-emails/${id}`);
      if (res.ok) setViewing(await res.json());
    } finally {
      setLoadingId(null);
    }
  }

  const filtered = emails.filter((e) => {
    if (filter !== "all" && e.category !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.subject.toLowerCase().includes(q)
      || e.toAddress.toLowerCase().includes(q)
      || (e.customerName ?? "").toLowerCase().includes(q)
      || (e.relatedLabel ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {CATEGORIES.map((c) => {
            const count = c.key === "all" ? emails.length : emails.filter((e) => e.category === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === c.key ? "bg-brand-blue text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {c.label}
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
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 w-56"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Onderwerp</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Aan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Klant</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Document</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Datum</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Bekijk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-14 text-center text-slate-400">Geen verstuurde e-mails</td></tr>
            )}
            {filtered.map((e) => {
              const meta = CAT_META[e.category] ?? CAT_META.OTHER;
              const Icon = meta.Icon;
              const href = relatedHref(e);
              return (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded ${meta.color}`}>
                      <Icon className="w-3.5 h-3.5" />{meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{e.subject}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.toAddress}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.customerName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {href && e.relatedLabel ? (
                      <Link href={href} className="text-slate-500 hover:text-brand-blue hover:underline">{e.relatedLabel}</Link>
                    ) : (
                      <span className="text-slate-300">{e.relatedLabel ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmt(e.sentAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => view(e.id)} disabled={loadingId === e.id} className="inline-flex text-slate-400 hover:text-brand-blue disabled:opacity-50" title="Bekijk mail">
                      {loadingId === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(ev) => ev.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{viewing.subject}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  aan {viewing.toAddress}{viewing.ccAddress ? ` · cc ${viewing.ccAddress}` : ""} · {fmt(viewing.sentAt)}
                </p>
              </div>
              <button onClick={() => setViewing(null)} className="p-1.5 text-slate-400 hover:text-slate-700 shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <iframe sandbox="" srcDoc={viewing.bodyHtml} className="w-full flex-1 min-h-[50vh] bg-white" title="E-mailinhoud" />
          </div>
        </div>
      )}
    </div>
  );
}
