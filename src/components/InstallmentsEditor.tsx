"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type Installment = {
  id: string;
  installmentNumber: number;
  dueDate: string;
  percentage: number | null;
  amount: number | null;
  isPaid: boolean;
  notes: string | null;
};

interface Props {
  invoiceId: string;
  invoiceTotal: number;
  installments: Installment[];
  locked?: boolean;
}

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addMonths(base: Date, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return dateStr(d);
}

export function InstallmentsEditor({ invoiceId, invoiceTotal, installments: initial, locked = false }: Props) {
  const router = useRouter();
  const [installments, setInstallments] = useState<Installment[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function readError(res: Response): Promise<string> {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error ?? "Er ging iets mis";
  }

  // Nieuwe termijn form
  const today = new Date();
  const [form, setForm] = useState({
    dueDate: addMonths(today, 1),
    usePercent: true,
    percentage: "",
    amount: "",
    notes: "",
  });

  // Preset knoppen
  async function applyPreset(parts: number[]) {
    setSaving(true);
    setError(null);
    try {
      // Reset eerst
      const resetRes = await fetch(`/api/invoices/${invoiceId}/installments`, { method: "DELETE" });
      if (!resetRes.ok) { setError(await readError(resetRes)); return; }
      const created: Installment[] = [];
      for (let i = 0; i < parts.length; i++) {
        const res = await fetch(`/api/invoices/${invoiceId}/installments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            installmentNumber: i + 1,
            dueDate: addMonths(today, i + 1),
            percentage: parts[i],
            amount: null,
          }),
        });
        if (res.ok) {
          const data = await res.json() as Installment;
          created.push({ ...data, dueDate: new Date(data.dueDate).toISOString() });
        } else {
          setError(await readError(res));
        }
      }
      setInstallments(created);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function addInstallment() {
    if (!form.dueDate) return;
    if (form.usePercent && !form.percentage) return;
    if (!form.usePercent && !form.amount) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/installments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentNumber: installments.length + 1,
          dueDate: form.dueDate,
          percentage: form.usePercent ? Number(form.percentage) : null,
          amount: !form.usePercent ? Number(form.amount) : null,
          notes: form.notes.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json() as Installment;
        setInstallments(prev => [...prev, { ...data, dueDate: new Date(data.dueDate).toISOString() }]);
        setForm({ dueDate: addMonths(today, installments.length + 2), usePercent: true, percentage: "", amount: "", notes: "" });
        setShowForm(false);
        router.refresh();
      } else {
        setError(await readError(res));
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(inst: Installment) {
    setTogglingId(inst.id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/installments/${inst.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: !inst.isPaid }),
      });
      if (res.ok) {
        setInstallments(prev =>
          prev.map(i => i.id === inst.id ? { ...i, isPaid: !inst.isPaid } : i)
        );
        router.refresh();
      } else {
        setError(await readError(res));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteInstallment(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/installments/${id}`, { method: "DELETE" });
      if (res.ok) {
        setInstallments(prev => prev.filter(i => i.id !== id));
        router.refresh();
      } else {
        setError(await readError(res));
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function resetAll() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/installments`, { method: "DELETE" });
      if (res.ok) {
        setInstallments([]);
        router.refresh();
      } else {
        setError(await readError(res));
      }
    } finally {
      setSaving(false);
    }
  }

  // Bereken bedragen uit percentages
  function instAmount(inst: Installment): number {
    if (inst.amount !== null) return inst.amount;
    if (inst.percentage !== null) return (inst.percentage / 100) * invoiceTotal;
    return 0;
  }

  const totalAssigned = installments.reduce((s, i) => s + instAmount(i), 0);
  const remaining = invoiceTotal - totalAssigned;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}
      {/* Bestaande termijnen */}
      {installments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vervaldatum</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">%</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bedrag</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Betaald</th>
                {!locked && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {installments.map((inst) => {
                const amt = instAmount(inst);
                const overdue = !inst.isPaid && new Date(inst.dueDate) < today;
                return (
                  <tr key={inst.id} className={inst.isPaid ? "opacity-60" : ""}>
                    <td className="px-4 py-3 text-slate-400 text-xs">{inst.installmentNumber}</td>
                    <td className={`px-4 py-3 ${overdue ? "text-red-600 font-medium" : "text-slate-600"}`}>
                      {formatDate(new Date(inst.dueDate))}
                      {inst.notes && (
                        <span className="ml-2 text-xs text-slate-400">· {inst.notes}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 text-xs">
                      {inst.percentage !== null ? `${inst.percentage}%` : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      inst.isPaid ? "text-green-700" : overdue ? "text-red-600" : "text-slate-800"
                    }`}>
                      {formatCurrency(amt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!locked ? (
                        <button
                          onClick={() => togglePaid(inst)}
                          disabled={togglingId === inst.id}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
                            inst.isPaid
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-slate-300 hover:border-green-400"
                          }`}
                          title={inst.isPaid ? "Markeer als onbetaald" : "Markeer als betaald"}
                        >
                          {togglingId === inst.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : inst.isPaid
                            ? <Check className="w-3 h-3" />
                            : null}
                        </button>
                      ) : (
                        <span className={`text-xs font-medium ${inst.isPaid ? "text-green-600" : "text-slate-400"}`}>
                          {inst.isPaid ? "✓" : "—"}
                        </span>
                      )}
                    </td>
                    {!locked && (
                      <td className="px-2 py-3">
                        <button
                          onClick={() => deleteInstallment(inst.id)}
                          disabled={deletingId === inst.id}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          {deletingId === inst.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={3} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                  Totaal termijnen
                </td>
                <td className={`px-4 py-2.5 text-right text-xs font-bold ${
                  Math.abs(remaining) < 0.01 ? "text-green-700" : "text-amber-600"
                }`}>
                  {formatCurrency(totalAssigned)}
                  {Math.abs(remaining) >= 0.01 && (
                    <span className="ml-1 font-normal">
                      ({remaining > 0 ? `nog ${formatCurrency(remaining)} toe te wijzen` : `${formatCurrency(Math.abs(remaining))} te veel`})
                    </span>
                  )}
                </td>
                <td colSpan={locked ? 1 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!locked && (
        <div className="space-y-3">
          {/* Preset knoppen */}
          {installments.length === 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Snelstart:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "30/70", parts: [30, 70] },
                  { label: "50/50", parts: [50, 50] },
                  { label: "33/33/34", parts: [33, 33, 34] },
                  { label: "25/25/25/25", parts: [25, 25, 25, 25] },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset.parts)}
                    disabled={saving}
                    className="text-xs font-medium border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:border-brand-blue/40 hover:text-brand-blue transition-colors disabled:opacity-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toevoegen knop */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-blue border border-brand-blue/20 bg-brand-blue-light px-3 py-1.5 rounded-lg hover:bg-brand-blue/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Termijn toevoegen
              {showForm ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </button>
            {installments.length > 0 && (
              <button
                onClick={resetAll}
                disabled={saving}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                Alles verwijderen
              </button>
            )}
          </div>

          {/* Formulier */}
          {showForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vervaldatum</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setForm(f => ({ ...f, usePercent: true }))}
                      className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                        form.usePercent
                          ? "bg-brand-blue text-white border-brand-blue"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      Percentage
                    </button>
                    <button
                      onClick={() => setForm(f => ({ ...f, usePercent: false }))}
                      className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                        !form.usePercent
                          ? "bg-brand-blue text-white border-brand-blue"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      Bedrag
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  {form.usePercent ? (
                    <>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Percentage
                        {form.percentage && invoiceTotal > 0 && (
                          <span className="ml-2 font-normal text-slate-400">
                            = {formatCurrency((Number(form.percentage) / 100) * invoiceTotal)}
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={form.percentage}
                          onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))}
                          placeholder="30"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Bedrag (€)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.amount}
                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white"
                      />
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Omschrijving (optioneel)</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="bijv. Aanbetaling"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={addInstallment}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Toevoegen
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs text-slate-500 px-3 py-2 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
