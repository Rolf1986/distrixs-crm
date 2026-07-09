"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, CalendarDays, Trash2, X, Loader2 } from "lucide-react";

type QuoteLine = { id: string; title: string; qty: number };

export function OcRowActions({
  ocId,
  confirmationNumber,
  expectedDelivery,
  lineDeliveries,
  quoteLines,
}: {
  ocId: string;
  confirmationNumber: string;
  expectedDelivery: string | null; // ISO of null
  lineDeliveries: Record<string, string>;
  quoteLines: QuoteLine[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerDate, setHeaderDate] = useState(expectedDelivery?.slice(0, 10) ?? "");
  const [dates, setDates] = useState<Record<string, string>>(
    Object.fromEntries(quoteLines.map((l) => [l.id, lineDeliveries[l.id]?.slice(0, 10) ?? ""]))
  );

  function applyToAll() {
    if (!headerDate) return;
    setDates(Object.fromEntries(quoteLines.map((l) => [l.id, headerDate])));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(dates)) {
        if (v) cleaned[k] = v;
      }
      const res = await fetch(`/api/order-confirmations/${ocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedDelivery: headerDate || null,
          lineDeliveries: cleaned,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Opslaan mislukt");
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Orderbevestiging ${confirmationNumber} verwijderen?`)) return;
    const res = await fetch(`/api/order-confirmations/${ocId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? "Verwijderen mislukt");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1 relative z-10">
      <a
        href={`/api/order-confirmations/${ocId}/pdf`}
        download={`${confirmationNumber}.pdf`}
        title="Download PDF"
        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition-colors"
      >
        <Download className="w-4 h-4" />
      </a>
      {quoteLines.length > 0 && (
        <button
          onClick={() => setOpen(true)}
          title="Leverdata per regel"
          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition-colors"
        >
          <CalendarDays className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={remove}
        title="Verwijderen"
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Leverdata</h3>
                <p className="text-xs text-slate-400">{confirmationNumber}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex items-end gap-2 pb-4 border-b border-slate-100">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Verwachte levering (algemeen)
                  </label>
                  <input
                    type="date"
                    value={headerDate}
                    onChange={(e) => setHeaderDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                  />
                </div>
                <button
                  onClick={applyToAll}
                  disabled={!headerDate}
                  className="text-xs font-medium text-brand-blue border border-brand-blue/20 bg-brand-blue-light rounded-lg px-3 py-2.5 hover:bg-brand-blue/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  Alles op deze datum
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Per regel</p>
                {quoteLines.map((l) => (
                  <div key={l.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-700 truncate">
                      {l.title} <span className="text-slate-400 text-xs">× {l.qty}</span>
                    </span>
                    <input
                      type="date"
                      value={dates[l.id] ?? ""}
                      onChange={(e) => setDates((d) => ({ ...d, [l.id]: e.target.value }))}
                      className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                  </div>
                ))}
                <p className="text-[11px] text-slate-400">
                  Regels zonder eigen datum volgen de algemene verwachte levering.
                </p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-sm font-medium bg-brand-blue text-white px-4 py-2 rounded-lg hover:bg-brand-blue-dark disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
