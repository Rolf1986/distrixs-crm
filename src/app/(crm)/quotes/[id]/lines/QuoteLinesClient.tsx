"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Loader2, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const VAT_RATES = [0, 9, 21] as const;
type VatRate = (typeof VAT_RATES)[number];

type Line = {
  id: string;
  skuSnapshot: string;
  titleSnapshot: string;
  qty: number;
  grossUnitPrice: number;
  discountPercent: number;
  netLineTotal: number;
  vatRate: number;
  vatAmount: number;
  costSnapshot?: number;
};

type Product = {
  id: string;
  sku: string;
  title: string;
  advisorySellPrice: number;
  baseCostPrice: number;
};

type VatGroup = { rate: number; base: number; vat: number };

const inputClass =
  "rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white";

function calcNet(price: number, qty: number, discount: number) {
  return price * qty * (1 - discount / 100);
}

function calcLineVat(netLineTotal: number, vatRate: number) {
  return netLineTotal * (vatRate / 100);
}

function calcTotalsFromLines(lines: { netLineTotal: number; vatRate: number }[]) {
  const subtotal = lines.reduce((s, l) => s + l.netLineTotal, 0);
  const groupMap = new Map<number, { base: number; vat: number }>();
  for (const l of lines) {
    const lineVat = calcLineVat(l.netLineTotal, l.vatRate);
    const existing = groupMap.get(l.vatRate) ?? { base: 0, vat: 0 };
    groupMap.set(l.vatRate, { base: existing.base + l.netLineTotal, vat: existing.vat + lineVat });
  }
  const vatBreakdown: VatGroup[] = Array.from(groupMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, { base, vat }]) => ({ rate, base, vat }));
  const vatAmount = vatBreakdown.reduce((s, g) => s + g.vat, 0);
  return { subtotal, vatBreakdown, vatAmount, total: subtotal + vatAmount };
}

export function QuoteLinesClient({
  quoteId,
  initialLines,
  products,
  defaultVatRate = 21,
}: {
  quoteId: string;
  initialLines: Line[];
  products: Product[];
  defaultVatRate?: number;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Inline edit state per row
  const [editing, setEditing] = useState<Record<string, Partial<Line>>>({});

  // Add form state
  const [addSearch, setAddSearch] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addSku, setAddSku] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [addDiscount, setAddDiscount] = useState("0");
  const [addVatRate, setAddVatRate] = useState<VatRate>(defaultVatRate as VatRate);
  const [addCostPrice, setAddCostPrice] = useState(0);

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(addSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(addSearch.toLowerCase())
  );

  function startEdit(line: Line) {
    setEditing((prev) => ({
      ...prev,
      [line.id]: {
        titleSnapshot: line.titleSnapshot,
        qty: line.qty,
        grossUnitPrice: line.grossUnitPrice,
        discountPercent: line.discountPercent,
        vatRate: line.vatRate,
        costSnapshot: line.costSnapshot ?? 0,
      },
    }));
  }

  function cancelEdit(lineId: string) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  async function saveLine(lineId: string) {
    const edits = editing[lineId];
    if (!edits) return;
    setSaving(lineId);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edits),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Fout bij opslaan");
        return;
      }
      const updated = await res.json();
      setLines((prev) =>
        prev.map((l) =>
          l.id === lineId
            ? {
                id: updated.id,
                skuSnapshot: updated.skuSnapshot,
                titleSnapshot: updated.titleSnapshot,
                qty: Number(updated.qty),
                grossUnitPrice: Number(updated.grossUnitPrice),
                discountPercent: Number(updated.discountPercent),
                netLineTotal: Number(updated.netLineTotal),
                vatRate: Number(updated.vatRate),
                vatAmount: Number(updated.vatAmount),
                costSnapshot: Number(updated.costSnapshot ?? 0),
              }
            : l
        )
      );
      cancelEdit(lineId);
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  async function deleteLine(lineId: string) {
    setDeleting(lineId);
    try {
      await fetch(`/api/quotes/${quoteId}/lines/${lineId}`, { method: "DELETE" });
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  async function addLine() {
    if (!addTitle || !addQty || !addPrice) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: addProductId || null,
          skuSnapshot: addSku,
          titleSnapshot: addTitle,
          qty: Number(addQty),
          grossUnitPrice: Number(addPrice),
          discountPercent: Number(addDiscount),
          vatRate: addVatRate,
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
          grossUnitPrice: Number(line.grossUnitPrice),
          discountPercent: Number(line.discountPercent),
          netLineTotal: Number(line.netLineTotal),
          vatRate: Number(line.vatRate),
          vatAmount: Number(line.vatAmount),
        },
      ]);
      // Reset form
      setAddSearch("");
      setAddProductId("");
      setAddTitle("");
      setAddSku("");
      setAddQty("1");
      setAddPrice("");
      setAddDiscount("0");
      setAddVatRate(defaultVatRate as VatRate);
      setAddCostPrice(0);
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  // Live totals — use editing state for preview
  const liveLines = lines.map((l) => {
    const ed = editing[l.id];
    if (ed) {
      const net = calcNet(
        Number(ed.grossUnitPrice ?? l.grossUnitPrice),
        Number(ed.qty ?? l.qty),
        Number(ed.discountPercent ?? l.discountPercent)
      );
      return { netLineTotal: net, vatRate: Number(ed.vatRate ?? l.vatRate) };
    }
    return { netLineTotal: l.netLineTotal, vatRate: l.vatRate };
  });

  const { subtotal, vatBreakdown, vatAmount, total } = calcTotalsFromLines(liveLines);

  // colspan for the table: SKU, Omschrijving, Aantal, Bruto prijs, Korting %, BTW %, BTW bedrag, Regel totaal, Actions = 9
  const COL_COUNT = 9;

  return (
    <div className="space-y-6">
      {/* Regels tabel */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Offerteregels
          </h2>
          <span className="text-xs text-slate-400">{lines.length} regel{lines.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Omschrijving</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aantal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bruto prijs</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Korting %</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">BTW %</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">BTW</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Regel totaal</th>
                <th className="w-20 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={COL_COUNT} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Nog geen regels — voeg hieronder een product toe
                  </td>
                </tr>
              )}
              {lines.map((line) => {
                const ed = editing[line.id];
                const isEditing = !!ed;
                const previewNet = isEditing
                  ? calcNet(
                      Number(ed.grossUnitPrice ?? line.grossUnitPrice),
                      Number(ed.qty ?? line.qty),
                      Number(ed.discountPercent ?? line.discountPercent)
                    )
                  : line.netLineTotal;
                const previewVatRate = isEditing ? Number(ed.vatRate ?? line.vatRate) : line.vatRate;
                const previewVat = calcLineVat(previewNet, previewVatRate);

                return (
                  <tr
                    key={line.id}
                    className={`transition-colors ${isEditing ? "bg-brand-blue-light" : "hover:bg-slate-50 cursor-pointer"}`}
                    onClick={() => !isEditing && startEdit(line)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{line.skuSnapshot}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            className={`${inputClass} w-full`}
                            value={String(ed.titleSnapshot ?? line.titleSnapshot)}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [line.id]: { ...prev[line.id], titleSnapshot: e.target.value },
                              }))
                            }
                          />
                          <label className="flex items-center gap-1.5 text-xs text-slate-500">
                            Inkoop (€)
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className={`${inputClass} w-28`}
                              value={String(ed.costSnapshot ?? line.costSnapshot ?? 0)}
                              onChange={(e) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [line.id]: { ...prev[line.id], costSnapshot: Number(e.target.value) },
                                }))
                              }
                            />
                          </label>
                        </div>
                      ) : (
                        <span className="text-slate-700 font-medium">{line.titleSnapshot}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          className={`${inputClass} w-20 text-right`}
                          value={String(ed.qty ?? line.qty)}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [line.id]: { ...prev[line.id], qty: Number(e.target.value) },
                            }))
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-slate-600">{line.qty}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={`${inputClass} w-28 text-right`}
                          value={String(ed.grossUnitPrice ?? line.grossUnitPrice)}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [line.id]: { ...prev[line.id], grossUnitPrice: Number(e.target.value) },
                            }))
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-slate-600">{formatCurrency(line.grossUnitPrice)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className={`${inputClass} w-20 text-right`}
                          value={String(ed.discountPercent ?? line.discountPercent)}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [line.id]: { ...prev[line.id], discountPercent: Number(e.target.value) },
                            }))
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-slate-500">
                          {line.discountPercent > 0 ? `${line.discountPercent}%` : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <select
                          className={`${inputClass} w-20 text-right`}
                          value={String(ed.vatRate ?? line.vatRate)}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [line.id]: { ...prev[line.id], vatRate: Number(e.target.value) },
                            }))
                          }
                          onClick={(e) => e.stopPropagation()}
                        >
                          {VAT_RATES.map((r) => (
                            <option key={r} value={r}>{r}%</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-500">{line.vatRate}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {formatCurrency(previewVat)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(previewNet)}
                    </td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => saveLine(line.id)}
                            disabled={saving === line.id}
                            className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                            title="Opslaan"
                          >
                            {saving === line.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => cancelEdit(line.id)}
                            className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
                            title="Annuleren"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => deleteLine(line.id)}
                          disabled={deleting === line.id}
                          className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          title="Regel verwijderen"
                        >
                          {deleting === line.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={COL_COUNT - 2} className="px-4 py-2 text-right text-sm text-slate-500">Subtotaal excl. BTW</td>
                <td className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(subtotal)}</td>
                <td />
              </tr>
              {vatBreakdown.map((g) => (
                <tr key={g.rate}>
                  <td colSpan={COL_COUNT - 2} className="px-4 py-1.5 text-right text-sm text-slate-500">
                    BTW {g.rate}% over {formatCurrency(g.base)}
                  </td>
                  <td className="px-4 py-1.5 text-right text-slate-700">{formatCurrency(g.vat)}</td>
                  <td />
                </tr>
              ))}
              {vatBreakdown.length > 1 && (
                <tr>
                  <td colSpan={COL_COUNT - 2} className="px-4 py-1.5 text-right text-sm text-slate-500">Totaal BTW</td>
                  <td className="px-4 py-1.5 text-right text-slate-700">{formatCurrency(vatAmount)}</td>
                  <td />
                </tr>
              )}
              <tr className="border-t border-slate-200">
                <td colSpan={COL_COUNT - 2} className="px-4 py-3 text-right font-semibold text-slate-700">Totaal incl. BTW</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">{formatCurrency(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">Klik op een regel om te bewerken.</p>
      </div>

      {/* Regel toevoegen */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          Regel toevoegen
        </h3>
        {defaultVatRate === 0 && (
          <div className="mb-4 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            EU-klant met btw-nummer → nieuwe regels staan standaard op <strong>0% (btw verlegd)</strong>.
          </div>
        )}
        <div className="space-y-3">
          {/* Zoeken */}
          <input
            className={`${inputClass} w-full`}
            placeholder="Zoek product op naam of SKU… (of vul handmatig in)"
            value={addSearch}
            onChange={(e) => {
              setAddSearch(e.target.value);
              if (addProductId) {
                setAddProductId("");
              }
              setAddTitle(e.target.value);
            }}
          />

          {/* Producten dropdown */}
          {addSearch && !addProductId && filteredProducts.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {filteredProducts.slice(0, 20).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setAddProductId(p.id);
                    setAddSearch(p.title);
                    setAddTitle(p.title);
                    setAddSku(p.sku);
                    setAddPrice(String(p.advisorySellPrice));
                    setAddCostPrice(p.baseCostPrice);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center"
                >
                  <span className="text-slate-900 font-medium">{p.title}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    {p.baseCostPrice > 0 && (
                      <span className="text-slate-400 text-xs">ink. {formatCurrency(p.baseCostPrice)}</span>
                    )}
                    <span className="text-slate-400 font-mono text-xs">{p.sku}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Handmatige invoer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">SKU (optioneel)</label>
              <input
                className={`${inputClass} w-full`}
                placeholder="Leeg = eenmalige regel"
                value={addSku}
                onChange={(e) => setAddSku(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Omschrijving</label>
              <input
                className={`${inputClass} w-full`}
                placeholder="Productnaam"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Aantal</label>
              <input
                type="number"
                min="1"
                className={`${inputClass} w-20`}
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bruto prijs (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`${inputClass} w-28`}
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Korting %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                className={`${inputClass} w-20`}
                value={addDiscount}
                onChange={(e) => setAddDiscount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">BTW %</label>
              <select
                className={`${inputClass} w-20`}
                value={addVatRate}
                onChange={(e) => setAddVatRate(Number(e.target.value) as VatRate)}
              >
                {VAT_RATES.map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Inkoopprijs (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`${inputClass} w-28`}
                value={addCostPrice || ""}
                onChange={(e) => setAddCostPrice(Number(e.target.value))}
                placeholder="0.00"
              />
            </div>
            <div className="ml-auto flex items-end gap-3">
              {addPrice && addQty && (() => {
                const net = calcNet(Number(addPrice), Number(addQty), Number(addDiscount));
                const margin = addCostPrice > 0 ? net - (Number(addQty) * addCostPrice) : null;
                const marginPct = margin !== null && net > 0 ? (margin / net) * 100 : null;
                return (
                  <div className="text-sm pb-2 text-right">
                    <div className="text-slate-500">= {formatCurrency(net)}</div>
                    {margin !== null ? (
                      <div className={`text-xs font-medium ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                        Marge: {formatCurrency(margin)} ({marginPct?.toFixed(1)}%)
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">Marge: vul inkoopprijs in</div>
                    )}
                  </div>
                );
              })()}
              <button
                onClick={addLine}
                disabled={adding || !addTitle || !addQty || !addPrice}
                className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Toevoegen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
