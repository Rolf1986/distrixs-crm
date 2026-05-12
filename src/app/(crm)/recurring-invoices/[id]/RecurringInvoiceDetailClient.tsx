"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Play, RefreshCw, Save } from "lucide-react";

type LineData = {
  id: string;
  skuSnapshot: string;
  titleSnapshot: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
  sortOrder: number;
};

type RecurringData = {
  id: string;
  description: string;
  frequency: string;
  nextRunDate: string;
  endDate: string | null;
  isActive: boolean;
  paymentTermType: string;
  language: string;
  customerId: string;
  customerName: string;
  lines: LineData[];
};

type RunResult = { invoiceId: string; invoiceNumber: string };

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

export function RecurringInvoiceDetailClient({ recurring }: { recurring: RecurringData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const [description, setDescription] = useState(recurring.description);
  const [frequency, setFrequency] = useState(recurring.frequency);
  const [nextRunDate, setNextRunDate] = useState(recurring.nextRunDate.split("T")[0]);
  const [endDate, setEndDate] = useState(recurring.endDate?.split("T")[0] ?? "");
  const [isActive, setIsActive] = useState(recurring.isActive);
  const [paymentTermType, setPaymentTermType] = useState(recurring.paymentTermType);
  const [language, setLanguage] = useState(recurring.language);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/recurring-invoices/${recurring.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          frequency,
          nextRunDate,
          endDate: endDate || null,
          isActive,
          paymentTermType,
          language,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      alert("Fout bij opslaan: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    try {
      const res = await fetch(`/api/recurring-invoices/${recurring.id}/run`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const result: RunResult = await res.json();
      setRunResult(result);
      router.refresh();
    } catch (err) {
      alert("Fout bij uitvoeren: " + String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Bewerken</h3>
        <div className="flex items-center gap-2">
          {runResult && (
            <Link
              href={`/invoices/${runResult.invoiceId}/lines`}
              className="text-sm font-mono text-blue-600 hover:underline bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
            >
              Factuur aangemaakt: {runResult.invoiceNumber}
            </Link>
          )}
          <button
            onClick={handleRunNow}
            disabled={!isActive || running}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Nu uitvoeren
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: "#0170B9" }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Omschrijving</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Frequentie</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Betalingstermijn</label>
          <select
            value={paymentTermType}
            onChange={(e) => setPaymentTermType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {Object.entries(PAYMENT_TERM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Volgende uitvoering</label>
          <input
            type="date"
            value={nextRunDate}
            onChange={(e) => setNextRunDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Einddatum (optioneel)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Taal</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="NL">NL</option>
            <option value="EN">EN</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600">Actief</label>
          <button
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              isActive ? "bg-green-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                isActive ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
