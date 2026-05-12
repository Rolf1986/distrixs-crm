"use client";

import { useState } from "react";
import { Bell, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export type OverdueInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  total: number;
  openAmount: number;
  dueDate: string;
  daysOverdue: number;
};

type Result = { sent: number; simulated: number; errors: string[] };

export function BulkReminderButton({ overdueInvoices }: { overdueInvoices: OverdueInvoice[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(overdueInvoices.map((i) => i.id)));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(overdueInvoices.map((i) => i.id)));
    } else {
      setSelected(new Set());
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendReminders() {
    if (selected.size === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/invoices/bulk-remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: Array.from(selected) }),
      });
      const data: Result = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setResult(null);
    setSelected(new Set(overdueInvoices.map((i) => i.id)));
  }

  const allChecked = selected.size === overdueInvoices.length;
  const someChecked = selected.size > 0 && !allChecked;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={overdueInvoices.length === 0}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Bell className="w-4 h-4" />
        Herinneringen versturen ({overdueInvoices.length} openstaand)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Herinneringen versturen</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {overdueInvoices.length} openstaande facturen · {selected.size} geselecteerd
                </p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Result banner */}
            {result && (
              <div className={`mx-6 mt-4 rounded-xl p-4 text-sm ${result.errors.length === 0 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                <div className="flex items-start gap-2">
                  {result.errors.length === 0
                    ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  }
                  <div>
                    <p className="font-medium text-slate-800">
                      {result.sent} verstuurd · {result.simulated} gesimuleerd
                      {result.errors.length > 0 && ` · ${result.errors.length} fout(en)`}
                    </p>
                    {result.errors.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-amber-800">
                        {result.errors.map((e, i) => <li key={i} className="text-xs">{e}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="w-8 pb-2">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => { if (el) el.indeterminate = someChecked; }}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="text-left pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Klant</th>
                    <th className="text-left pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Factuurnr</th>
                    <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bedrag</th>
                    <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dagen over tijd</th>
                    <th className="text-left pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mailadres</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {overdueInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${selected.has(inv.id) ? "bg-white" : "opacity-50"}`}
                      onClick={() => toggle(inv.id)}
                    >
                      <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(inv.id)}
                          onChange={() => toggle(inv.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-2.5 font-medium text-slate-800 cursor-pointer">{inv.customerName}</td>
                      <td className="py-2.5 font-mono text-xs text-slate-600 cursor-pointer">{inv.invoiceNumber}</td>
                      <td className="py-2.5 text-right text-slate-700 cursor-pointer">{formatCurrency(inv.openAmount)}</td>
                      <td className="py-2.5 text-right cursor-pointer">
                        <span className="text-red-600 font-semibold">{inv.daysOverdue} dgn</span>
                      </td>
                      <td className="py-2.5 cursor-pointer">
                        {inv.customerEmail
                          ? <span className="text-slate-500 text-xs">{inv.customerEmail}</span>
                          : <span className="text-red-400 text-xs">Geen e-mail</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                {selected.size} van {overdueInvoices.length} facturen geselecteerd
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                >
                  Sluiten
                </button>
                <button
                  onClick={sendReminders}
                  disabled={selected.size === 0 || loading || result !== null}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verstuur {selected.size} {selected.size === 1 ? "herinnering" : "herinneringen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
