"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileX, Loader2, Plus, Trash2 } from "lucide-react";

interface InvoiceLine {
  id: string;
  skuSnapshot: string;
  titleSnapshot: string;
  qty: number;
  grossUnitPrice: number;
  netLineTotal: number;
  vatRate: number;
}

interface CreateCreditNoteButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  lines: InvoiceLine[];
}

const CREDITABLE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"];

function fmt(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

export function CreateCreditNoteButton({
  invoiceId,
  invoiceNumber,
  status,
  lines,
}: CreateCreditNoteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  // per regel: te crediteren aantal (0 = niet crediteren)
  const [creditQty, setCreditQty] = useState<Record<string, number>>({});
  // vrije regels (bijv. "Compensatie"), bedrag excl. btw
  type CustomLine = { key: number; description: string; amount: string; vatRate: number };
  const [customLines, setCustomLines] = useState<CustomLine[]>([]);
  const [customKey, setCustomKey] = useState(1);

  if (!CREDITABLE_STATUSES.includes(status)) return null;

  function openModal() {
    // standaard: alle regels volledig geselecteerd
    const init: Record<string, number> = {};
    for (const l of lines) init[l.id] = l.qty;
    setCreditQty(init);
    setCustomLines([]);
    setReason("");
    setError(null);
    setOpen(true);
  }

  function clearAllQty() {
    const zeroed: Record<string, number> = {};
    for (const l of lines) zeroed[l.id] = 0;
    setCreditQty(zeroed);
  }

  function addCustomLine() {
    const defaultVat = lines[0]?.vatRate ?? 21;
    setCustomLines((p) => [...p, { key: customKey, description: "", amount: "", vatRate: Number(defaultVat) }]);
    setCustomKey((k) => k + 1);
  }

  function updateCustomLine(key: number, patch: Partial<CustomLine>) {
    setCustomLines((p) => p.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function removeCustomLine(key: number) {
    setCustomLines((p) => p.filter((c) => c.key !== key));
  }

  function setQty(id: string, qty: number, max: number) {
    const clamped = Math.max(0, Math.min(qty, max));
    setCreditQty((p) => ({ ...p, [id]: clamped }));
  }

  const selected = lines
    .map((l) => ({ line: l, qty: creditQty[l.id] ?? 0 }))
    .filter((s) => s.qty > 0);

  const creditSubtotal = selected.reduce(
    (s, { line, qty }) => s + Math.abs(Number(line.netLineTotal)) * (qty / (line.qty || 1)),
    0
  );
  const creditVat = selected.reduce(
    (s, { line, qty }) =>
      s + Math.abs(Number(line.netLineTotal)) * (qty / (line.qty || 1)) * (Number(line.vatRate) / 100),
    0
  );
  const validCustom = customLines.filter((c) => c.description.trim() && Number(c.amount) > 0);
  const customSubtotal = validCustom.reduce((s, c) => s + Number(c.amount), 0);
  const customVat = validCustom.reduce((s, c) => s + Number(c.amount) * (c.vatRate / 100), 0);
  const creditTotal = creditSubtotal + creditVat + customSubtotal + customVat;

  async function handleConfirm() {
    if (selected.length === 0 && validCustom.length === 0) {
      setError("Selecteer minstens één regel of voeg een losse regel toe");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/credit-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim() || null,
          lines: selected.map(({ line, qty }) => ({ lineId: line.id, qty })),
          customLines: validCustom.map((c) => ({
            description: c.description.trim(),
            amount: Number(c.amount),
            vatRate: c.vatRate,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Er is een fout opgetreden");
        setLoading(false);
        return;
      }
      const { id } = await res.json();
      router.push(`/credit-notes/${id}`);
    } catch {
      setError("Netwerkfout — probeer het opnieuw");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 border border-slate-200 hover:border-red-300 bg-white text-slate-700 hover:text-red-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        title="Creditnota aanmaken"
      >
        <FileX className="w-4 h-4" />
        Creditnota
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                Creditnota voor <span className="font-mono">{invoiceNumber}</span>
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Kies welke regel(s) en welk aantal je wilt crediteren, of voeg een losse regel toe.
                <button
                  onClick={clearAllQty}
                  className="ml-2 text-brand-blue hover:underline text-xs font-medium"
                >
                  Zet alles op 0
                </button>
              </p>
            </div>

            <div className="px-6 py-4 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left py-2">Omschrijving</th>
                    <th className="text-right py-2 w-24">Factuur</th>
                    <th className="text-right py-2 w-28">Crediteren</th>
                    <th className="text-right py-2 w-28">Bedrag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lines.map((l) => {
                    const qty = creditQty[l.id] ?? 0;
                    const lineCredit = Math.abs(Number(l.netLineTotal)) * (qty / (l.qty || 1));
                    return (
                      <tr key={l.id} className={qty > 0 ? "" : "opacity-50"}>
                        <td className="py-2 pr-2">
                          <div className="font-medium text-slate-800">{l.titleSnapshot}</div>
                          <div className="text-xs text-slate-400 font-mono">{l.skuSnapshot}</div>
                        </td>
                        <td className="py-2 text-right text-slate-500">
                          {l.qty} × {fmt(Number(l.grossUnitPrice))}
                        </td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={l.qty}
                            step="any"
                            value={qty}
                            onChange={(e) => setQty(l.id, Number(e.target.value), l.qty)}
                            className="w-20 border border-slate-200 rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                          />
                        </td>
                        <td className="py-2 text-right font-medium text-red-600">
                          −{fmt(lineCredit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Vrije regels, los van de factuurregels (bijv. compensatie) */}
              <div className="mt-4 space-y-2">
                {customLines.map((c) => (
                  <div key={c.key} className="flex items-center gap-2">
                    <input
                      value={c.description}
                      onChange={(e) => updateCustomLine(c.key, { description: e.target.value })}
                      placeholder="bijv. Compensatie"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={c.amount}
                      onChange={(e) => updateCustomLine(c.key, { amount: e.target.value })}
                      placeholder="Bedrag excl."
                      className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                    <select
                      value={c.vatRate}
                      onChange={(e) => updateCustomLine(c.key, { vatRate: Number(e.target.value) })}
                      className="w-24 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    >
                      {[0, 9, 21].map((r) => (
                        <option key={r} value={r}>{r}% btw</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeCustomLine(c.key)}
                      className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Regel verwijderen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addCustomLine}
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Losse regel toevoegen (bijv. compensatie)
                </button>
              </div>

              <div className="mt-4">
                <label className="block text-xs text-slate-500 mb-1">Reden (optioneel)</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="bijv. retour flightcase"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>

              {error && (
                <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-sm">
                <span className="text-slate-500">Totaal te crediteren: </span>
                <span className="font-semibold text-red-600">−{fmt(creditTotal)}</span>
                <span className="text-xs text-slate-400"> (incl. btw)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setOpen(false); setError(null); }}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading || (selected.length === 0 && validCustom.length === 0)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Creditnota aanmaken
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
