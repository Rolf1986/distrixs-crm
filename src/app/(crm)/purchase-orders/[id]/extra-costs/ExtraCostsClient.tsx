"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const COST_TYPE_LABEL: Record<string, string> = {
  PRODUCT_PRICE: "Productprijs",
  IMPORT_DUTIES: "Invoerrechten",
  SHIPPING: "Transport",
};

const COST_TYPES = ["SHIPPING", "IMPORT_DUTIES", "PRODUCT_PRICE"] as const;

type ExtraCost = {
  id: string;
  costType: string;
  amount: number;
  currency: string;
  description: string | null;
};

const inputClass =
  "rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white";

export function ExtraCostsClient({
  poId,
  initialCosts,
}: {
  poId: string;
  initialCosts: ExtraCost[];
}) {
  const router = useRouter();
  const [costs, setCosts] = useState<ExtraCost[]>(initialCosts);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Form state
  const [type, setType] = useState<string>("SHIPPING");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [description, setDescription] = useState("");

  const total = costs.reduce((s, c) => s + c.amount, 0);

  async function deleteCost(costId: string) {
    setDeleting(costId);
    try {
      await fetch(`/api/purchase-orders/${poId}/extra-costs/${costId}`, { method: "DELETE" });
      setCosts((prev) => prev.filter((c) => c.id !== costId));
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  async function addCost() {
    if (!amount || Number(amount) <= 0) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/extra-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costType: type, amount: Number(amount), currency, description }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Fout bij toevoegen");
        return;
      }
      const cost = await res.json();
      setCosts((prev) => [...prev, { ...cost, amount: Number(cost.amount) }]);
      setAmount("");
      setDescription("");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Extra kosten</h2>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {costs.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              Nog geen extra kosten geregistreerd
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Omschrijving</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valuta</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bedrag</th>
                  <th className="w-10 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {costs.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700">{COST_TYPE_LABEL[c.costType] ?? c.costType}</td>
                    <td className="px-4 py-3 text-slate-500">{c.description ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.currency}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(c.amount)}</td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => deleteCost(c.id)}
                        disabled={deleting === c.id}
                        className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deleting === c.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Totaal extra kosten</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Toevoegen */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          Extra kost toevoegen
        </h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              {COST_TYPES.map((t) => (
                <option key={t} value={t}>{COST_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Bedrag</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} w-28`}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Valuta</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-slate-500 mb-1">Omschrijving</label>
            <input
              type="text"
              placeholder="Optioneel…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <button
            onClick={addCost}
            disabled={adding || !amount || Number(amount) <= 0}
            className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}
