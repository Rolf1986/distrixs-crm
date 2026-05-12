"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Play, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";

type RecurringItem = {
  id: string;
  description: string;
  frequency: string;
  nextRunDate: string;
  endDate: string | null;
  isActive: boolean;
  customerId: string;
  customerName: string;
  lineCount: number;
};

type Customer = { id: string; companyName: string };

type LineInput = {
  skuSnapshot: string;
  titleSnapshot: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
};

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Wekelijks",
  MONTHLY: "Maandelijks",
  QUARTERLY: "Kwartaal",
  YEARLY: "Jaarlijks",
};

const PAYMENT_TERM_LABELS: Record<string, string> = {
  DAYS_14: "14 dagen",
  DAYS_30: "30 dagen",
  PREPAYMENT: "Vooruitbetaling",
  INSTALLMENTS: "Termijnen",
};

type RunResult = { invoiceId: string; invoiceNumber: string };

const EMPTY_LINE: LineInput = {
  skuSnapshot: "",
  titleSnapshot: "",
  qty: 1,
  unitPrice: 0,
  vatRate: 21,
};

export function RecurringInvoicesClient({
  initialItems,
  customers,
}: {
  initialItems: RecurringItem[];
  customers: Customer[];
}) {
  const [items, setItems] = useState<RecurringItem[]>(initialItems);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runResults, setRunResults] = useState<Record<string, RunResult>>({});
  const [runningId, setRunningId] = useState<string | null>(null);

  // Form state
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFrequency, setFormFrequency] = useState("MONTHLY");
  const [formNextRunDate, setFormNextRunDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formEndDate, setFormEndDate] = useState("");
  const [formPaymentTerm, setFormPaymentTerm] = useState("DAYS_30");
  const [formLanguage, setFormLanguage] = useState("NL");
  const [formLines, setFormLines] = useState<LineInput[]>([{ ...EMPTY_LINE }]);

  function resetForm() {
    setFormCustomerId("");
    setFormDescription("");
    setFormFrequency("MONTHLY");
    setFormNextRunDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormPaymentTerm("DAYS_30");
    setFormLanguage("NL");
    setFormLines([{ ...EMPTY_LINE }]);
  }

  async function handleCreate() {
    if (!formCustomerId || !formDescription || !formNextRunDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/recurring-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formCustomerId,
          description: formDescription,
          frequency: formFrequency,
          nextRunDate: formNextRunDate,
          endDate: formEndDate || null,
          paymentTermType: formPaymentTerm,
          language: formLanguage,
          lines: formLines,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Refresh list
      const listRes = await fetch("/api/recurring-invoices");
      const data: RecurringItem[] = await listRes.json();
      setItems(data);
      setShowModal(false);
      resetForm();
    } catch (err) {
      alert("Fout bij aanmaken: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: RecurringItem) {
    const res = await fetch(`/api/recurring-invoices/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isActive: !i.isActive } : i))
      );
    }
  }

  async function handleRunNow(item: RecurringItem) {
    setRunningId(item.id);
    try {
      const res = await fetch(`/api/recurring-invoices/${item.id}/run`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const result: RunResult = await res.json();
      setRunResults((prev) => ({ ...prev, [item.id]: result }));
      // Refresh list to update nextRunDate
      const listRes = await fetch("/api/recurring-invoices");
      const data: RecurringItem[] = await listRes.json();
      setItems(data);
    } catch (err) {
      alert("Fout bij uitvoeren: " + String(err));
    } finally {
      setRunningId(null);
    }
  }

  function updateLine(idx: number, field: keyof LineInput, value: string | number) {
    setFormLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addLine() {
    setFormLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(idx: number) {
    setFormLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const isDue = (item: RecurringItem) => {
    const next = new Date(item.nextRunDate);
    return next <= new Date();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Terugkerende facturen worden automatisch aangemaakt op de geplande datum.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#0170B9" }}
        >
          <Plus className="w-4 h-4" />
          Nieuwe terugkerende factuur
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Klant</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Omschrijving</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Frequentie</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Volgende uitvoering</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Regels</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actief</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Geen terugkerende facturen gevonden
                </td>
              </tr>
            )}
            {items.map((item) => {
              const due = isDue(item) && item.isActive;
              const result = runResults[item.id];
              return (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700">{item.customerName}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/recurring-invoices/${item.id}`}
                      className="text-slate-900 font-medium hover:text-brand-blue transition-colors"
                    >
                      {item.description}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
                  </td>
                  <td className="px-4 py-3">
                    <span className={due ? "text-orange-600 font-medium" : "text-slate-600"}>
                      {formatDate(item.nextRunDate)}
                      {due && <span className="ml-1 text-xs">(vervallen)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{item.lineCount}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        item.isActive ? "bg-green-500" : "bg-slate-300"
                      }`}
                      title={item.isActive ? "Deactiveren" : "Activeren"}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          item.isActive ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRunNow(item)}
                        disabled={!item.isActive || runningId === item.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          item.isActive
                            ? "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                        title="Nu uitvoeren"
                      >
                        {runningId === item.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        Nu uitvoeren
                      </button>
                      {result && (
                        <Link
                          href={`/invoices/${result.invoiceId}/lines`}
                          className="text-xs font-mono text-blue-600 hover:underline"
                          title="Bekijk factuur"
                        >
                          {result.invoiceNumber}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Nieuwe terugkerende factuur</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Customer */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Klant *</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">Selecteer klant…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Omschrijving *</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="bijv. Maandelijkse servicekosten"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Frequency + PaymentTerm */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Frequentie</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="WEEKLY">Wekelijks</option>
                    <option value="MONTHLY">Maandelijks</option>
                    <option value="QUARTERLY">Kwartaal</option>
                    <option value="YEARLY">Jaarlijks</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Betalingstermijn</label>
                  <select
                    value={formPaymentTerm}
                    onChange={(e) => setFormPaymentTerm(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {Object.entries(PAYMENT_TERM_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Eerste uitvoering *</label>
                  <input
                    type="date"
                    value={formNextRunDate}
                    onChange={(e) => setFormNextRunDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Einddatum (optioneel)</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              {/* Language */}
              <div className="w-32">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Taal</label>
                <select
                  value={formLanguage}
                  onChange={(e) => setFormLanguage(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="NL">NL</option>
                  <option value="EN">EN</option>
                </select>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600">Regels *</label>
                  <button
                    onClick={addLine}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Regel toevoegen
                  </button>
                </div>
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 px-1">
                    <div className="col-span-2">SKU</div>
                    <div className="col-span-4">Omschrijving</div>
                    <div className="col-span-2">Aantal</div>
                    <div className="col-span-2">Prijs</div>
                    <div className="col-span-1">BTW%</div>
                    <div className="col-span-1"></div>
                  </div>
                  {formLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={line.skuSnapshot}
                        onChange={(e) => updateLine(idx, "skuSnapshot", e.target.value)}
                        placeholder="SKU"
                        className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                      <input
                        type="text"
                        value={line.titleSnapshot}
                        onChange={(e) => updateLine(idx, "titleSnapshot", e.target.value)}
                        placeholder="Omschrijving"
                        className="col-span-4 rounded border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                      <input
                        type="number"
                        value={line.qty}
                        min={0}
                        step="0.001"
                        onChange={(e) => updateLine(idx, "qty", parseFloat(e.target.value) || 0)}
                        className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                      <input
                        type="number"
                        value={line.unitPrice}
                        min={0}
                        step="0.01"
                        onChange={(e) => updateLine(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="col-span-2 rounded border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                      <select
                        value={line.vatRate}
                        onChange={(e) => updateLine(idx, "vatRate", parseFloat(e.target.value))}
                        className="col-span-1 rounded border border-slate-200 px-1 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                      >
                        <option value={0}>0%</option>
                        <option value={9}>9%</option>
                        <option value={21}>21%</option>
                      </select>
                      <button
                        onClick={() => removeLine(idx)}
                        disabled={formLines.length === 1}
                        className="col-span-1 text-slate-400 hover:text-red-500 disabled:opacity-30 text-xs text-center"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formCustomerId || !formDescription}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "#0170B9" }}
              >
                {saving ? "Bezig…" : "Aanmaken"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
