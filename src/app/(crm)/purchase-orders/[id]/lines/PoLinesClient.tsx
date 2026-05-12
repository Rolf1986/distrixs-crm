"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Line = {
  id: string;
  skuSnapshot: string;
  titleSnapshot: string;
  qtyOrdered: number;
  qtyReceived: number;
  baseCostSnapshot: number;
  status: string;
};

type Product = {
  id: string;
  sku: string;
  title: string;
  baseCostPrice: number;
};

const LINE_STATUS_LABEL: Record<string, string> = {
  PENDING: "In afwachting",
  PARTIALLY_RECEIVED: "Deels ontvangen",
  RECEIVED: "Ontvangen",
};
const LINE_STATUS_COLOR: Record<string, string> = {
  PENDING: "text-slate-400",
  PARTIALLY_RECEIVED: "text-orange-600",
  RECEIVED: "text-green-600",
};

const inputClass =
  "rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white";

export function PoLinesClient({
  poId,
  isChina,
  initialLines,
  products,
}: {
  poId: string;
  isChina: boolean;
  initialLines: Line[];
  products: Product[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Add form state
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addCost, setAddCost] = useState("");
  const [addSearch, setAddSearch] = useState("");

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(addSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(addSearch.toLowerCase())
  );

  const selectedProduct = products.find((p) => p.id === addProductId);

  async function deleteLine(lineId: string) {
    setDeleting(lineId);
    try {
      await fetch(`/api/purchase-orders/${poId}/lines/${lineId}`, { method: "DELETE" });
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
      const res = await fetch(`/api/purchase-orders/${poId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: addProductId,
          qtyOrdered: Number(addQty),
          baseCostOverride: addCost ? Number(addCost) : undefined,
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
          qtyOrdered: Number(line.qtyOrdered),
          qtyReceived: Number(line.qtyReceived),
          baseCostSnapshot: Number(line.baseCostSnapshot),
          status: line.status,
        },
      ]);
      // Reset form
      setAddProductId("");
      setAddQty("1");
      setAddCost("");
      setAddSearch("");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  const baseCostTotal = lines.reduce((s, l) => s + l.baseCostSnapshot * l.qtyOrdered, 0);
  const chinaShipping = isChina ? baseCostTotal * 0.08 : 0;
  const chinaImport = isChina ? baseCostTotal * 0.06 : 0;

  return (
    <div className="space-y-6">
      {/* Regels tabel */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Inkoopregels
          </h2>
          <span className="text-xs text-slate-400">{lines.length} regel{lines.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Omschrijving</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Besteld</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ontvangen</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Inkoopprijs</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totaal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Nog geen regels — voeg hieronder een product toe
                  </td>
                </tr>
              )}
              {lines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{line.skuSnapshot}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{line.titleSnapshot}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{line.qtyOrdered}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{line.qtyReceived}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatCurrency(line.baseCostSnapshot)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(line.baseCostSnapshot * line.qtyOrdered)}
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${LINE_STATUS_COLOR[line.status] ?? "text-slate-400"}`}>
                    {LINE_STATUS_LABEL[line.status] ?? line.status}
                  </td>
                  <td className="px-2 py-3">
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
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right text-sm text-slate-500">Basiskosten totaal</td>
                <td className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(baseCostTotal)}</td>
                <td colSpan={2} />
              </tr>
              {isChina && (
                <>
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-right text-sm text-orange-600">+ Geschat transport (8%)</td>
                    <td className="px-4 py-2 text-right font-medium text-orange-700">{formatCurrency(chinaShipping)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-right text-sm text-orange-600">+ Geschatte invoerrechten (6%)</td>
                    <td className="px-4 py-2 text-right font-medium text-orange-700">{formatCurrency(chinaImport)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Verwachte totaalkosten</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(baseCostTotal + chinaShipping + chinaImport)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Regel toevoegen */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          Regel toevoegen
        </h3>
        <div className="space-y-3">
          {/* Zoeken */}
          <input
            className={`${inputClass} w-full`}
            placeholder="Zoek product op naam of SKU…"
            value={addSearch}
            onChange={(e) => {
              setAddSearch(e.target.value);
              setAddProductId(""); // reset selection on new search
            }}
          />

          {/* Producten dropdown */}
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
                      setAddCost(String(p.baseCostPrice));
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center"
                  >
                    <span className="text-slate-900 font-medium">{p.title}</span>
                    <span className="text-slate-400 font-mono text-xs ml-2 shrink-0">{p.sku}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Details als product geselecteerd */}
          {selectedProduct && (
            <div className="flex gap-3 items-end">
              <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-slate-900">{selectedProduct.title}</span>
                <span className="text-slate-400 ml-2 font-mono text-xs">{selectedProduct.sku}</span>
              </div>
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
                <label className="block text-xs text-slate-500 mb-1">Inkoopprijs (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${inputClass} w-28`}
                  value={addCost}
                  onChange={(e) => setAddCost(e.target.value)}
                  placeholder={String(selectedProduct.baseCostPrice)}
                />
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
