"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Loader2, Pencil, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type DealLine = {
  id: string;
  skuSnapshot: string;
  titleSnapshot: string;
  qty: number;
  unit: string;
  grossUnitPrice: number;
  discountPercent: number;
  netLineTotal: number;
  expectedMarginTotal: number;
};

type Product = {
  id: string;
  sku: string;
  title: string;
  advisorySellPrice: number;
  baseCostPrice: number;
  unit: string;
};

const inputClass =
  "rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white";

function InlineEdit({
  value,
  onSave,
  prefix = "",
  suffix = "",
  step = "1",
  min = "0",
  isPrice = false,
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
  prefix?: string;
  suffix?: string;
  step?: string;
  min?: string;
  isPrice?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(draft);
    if (isNaN(n)) { setEditing(false); return; }
    setSaving(true);
    await onSave(n);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(String(value)); setEditing(true); }}
        className="group flex items-center gap-1 hover:text-brand-blue transition-colors"
      >
        {prefix}{isPrice ? formatCurrency(value) : value}{suffix}
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {prefix}
      <input
        autoFocus
        type="number"
        step={step}
        min={min}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className={`${inputClass} w-24`}
      />
      {suffix}
      <button onClick={save} disabled={saving} className="text-green-600 disabled:opacity-40">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function DealLinesClient({
  dealId,
  initialLines,
  products,
}: {
  dealId: string;
  initialLines: DealLine[];
  products: Product[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<DealLine[]>(initialLines);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [addDiscount, setAddDiscount] = useState("0");

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(addSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(addSearch.toLowerCase())
  );
  const selectedProduct = products.find((p) => p.id === addProductId);

  async function patchLine(lineId: string, data: Record<string, number>) {
    const res = await fetch(`/api/deals/${dealId}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setLines((prev) =>
        prev.map((l) =>
          l.id === lineId
            ? {
                ...l,
                qty: Number(updated.qty),
                grossUnitPrice: Number(updated.grossUnitPrice),
                discountPercent: Number(updated.discountPercent),
                netLineTotal: Number(updated.netLineTotal),
                expectedMarginTotal: Number(updated.expectedMarginTotal),
              }
            : l
        )
      );
      router.refresh();
    }
  }

  async function deleteLine(lineId: string) {
    setDeleting(lineId);
    try {
      await fetch(`/api/deals/${dealId}/lines/${lineId}`, { method: "DELETE" });
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  async function addLine() {
    if (!addProductId || !addQty) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: addProductId,
          qty: Number(addQty),
          grossUnitPriceOverride: addPrice ? Number(addPrice) : undefined,
          discountPercent: Number(addDiscount),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Fout bij toevoegen");
        return;
      }
      const line = await res.json();
      setLines((prev) => [
        ...prev,
        {
          id: line.id,
          skuSnapshot: line.skuSnapshot,
          titleSnapshot: line.titleSnapshot,
          qty: Number(line.qty),
          unit: line.product?.unit ?? selectedProduct?.unit ?? "stuk",
          grossUnitPrice: Number(line.grossUnitPrice),
          discountPercent: Number(line.discountPercent),
          netLineTotal: Number(line.netLineTotal),
          expectedMarginTotal: Number(line.expectedMarginTotal),
        },
      ]);
      setAddProductId("");
      setAddSearch("");
      setAddQty("1");
      setAddPrice("");
      setAddDiscount("0");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  const totalOmzet = lines.reduce((s, l) => s + l.netLineTotal, 0);
  const totalMarge = lines.reduce((s, l) => s + l.expectedMarginTotal, 0);
  const margePct = totalOmzet > 0 ? (totalMarge / totalOmzet) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Regels tabel */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Dealregels
          </h2>
          <span className="text-xs text-slate-400">{lines.length} regel{lines.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Omschrijving</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aantal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bruto prijs</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Korting</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Omzet</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Marge</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Nog geen producten — voeg hieronder een regel toe
                  </td>
                </tr>
              )}
              {lines.map((line) => {
                const margePct = line.netLineTotal > 0
                  ? (line.expectedMarginTotal / line.netLineTotal) * 100
                  : 0;
                return (
                  <tr key={line.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{line.skuSnapshot}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{line.titleSnapshot}</td>
                    <td className="px-4 py-3 text-right">
                      <InlineEdit
                        value={line.qty}
                        step="0.001"
                        min="0.001"
                        suffix={` ${line.unit}`}
                        isPrice={false}
                        onSave={(qty) => patchLine(line.id, { qty })}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InlineEdit
                        value={line.grossUnitPrice}
                        step="0.01"
                        isPrice={true}
                        onSave={(grossUnitPrice) => patchLine(line.id, { grossUnitPrice })}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InlineEdit
                        value={line.discountPercent}
                        step="0.5"
                        min="0"
                        suffix="%"
                        isPrice={false}
                        onSave={(discountPercent) => patchLine(line.id, { discountPercent })}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(line.netLineTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${line.expectedMarginTotal >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {formatCurrency(line.expectedMarginTotal)}
                      </span>
                      <span className="text-slate-400 text-xs ml-1">({margePct.toFixed(0)}%)</span>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => deleteLine(line.id)}
                        disabled={deleting === line.id}
                        className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Regel verwijderen"
                      >
                        {deleting === line.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Totaal</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(totalOmzet)}</td>
                <td className="px-4 py-3 text-right font-bold text-green-700">
                  {formatCurrency(totalMarge)}
                  {totalOmzet > 0 && (
                    <span className="text-xs font-normal text-slate-400 ml-1">({margePct.toFixed(1)}%)</span>
                  )}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Regel toevoegen */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          Product toevoegen
        </h3>
        <div className="space-y-3">
          <input
            className={`${inputClass} w-full`}
            placeholder="Zoek product op naam of SKU…"
            value={addSearch}
            onChange={(e) => {
              setAddSearch(e.target.value);
              setAddProductId("");
            }}
          />

          {addSearch && !addProductId && (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-400">Geen producten gevonden</div>
              ) : (
                filteredProducts.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setAddProductId(p.id);
                      setAddSearch(p.title);
                      setAddPrice(String(p.advisorySellPrice));
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center"
                  >
                    <span className="text-slate-900 font-medium">{p.title}</span>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-slate-400 font-mono text-xs">{p.sku}</span>
                      <span className="text-brand-blue text-xs font-medium">{formatCurrency(p.advisorySellPrice)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {selectedProduct && (
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-sm min-w-48">
                <span className="font-medium text-slate-900">{selectedProduct.title}</span>
                <span className="text-slate-400 ml-2 font-mono text-xs">{selectedProduct.sku}</span>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Aantal</label>
                <input type="number" min="0.001" step="0.001" className={`${inputClass} w-20`}
                  value={addQty} onChange={(e) => setAddQty(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Verkoopprijs (€)</label>
                <input type="number" step="0.01" min="0" className={`${inputClass} w-28`}
                  value={addPrice} onChange={(e) => setAddPrice(e.target.value)}
                  placeholder={String(selectedProduct.advisorySellPrice)} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Korting (%)</label>
                <input type="number" step="0.5" min="0" max="100" className={`${inputClass} w-20`}
                  value={addDiscount} onChange={(e) => setAddDiscount(e.target.value)} />
              </div>
              <button
                onClick={addLine}
                disabled={adding}
                className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Toevoegen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
