"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, X, ChevronDown } from "lucide-react";

type Supplier = { id: string; name: string; supplierType: string };

export type DealProductOption = {
  productId: string;
  sku: string;
  title: string;
  qty: number;
  supplierId: string | null;
  supplierName: string | null;
};

export function CreatePoButton({
  dealId,
  suppliers,
  dealProducts = [],
}: {
  dealId: string;
  suppliers?: Supplier[];
  /** Producten uit de offertes van de deal — direct aanvinkbaar voor de inkooporder */
  dealProducts?: DealProductOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, number>>(
    Object.fromEntries(dealProducts.map((p) => [p.productId, p.qty]))
  );

  function chooseSupplier(id: string) {
    setSupplierId(id);
    // Producten van deze leverancier standaard aanvinken
    setSelected(
      Object.fromEntries(
        dealProducts.map((p) => [p.productId, !!id && p.supplierId === id])
      )
    );
  }

  async function handleCreate() {
    if (!supplierId) return;
    setLoading(true);
    try {
      const lines = dealProducts
        .filter((p) => selected[p.productId])
        .map((p) => ({ productId: p.productId, qty: qtys[p.productId] || p.qty }));

      const res = await fetch(`/api/deals/${dealId}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, lines }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        alert(err.error ?? "Fout bij aanmaken inkooporder");
        return;
      }
      const data = await res.json() as { id: string };
      setOpen(false);
      router.push(`/purchase-orders/${data.id}/lines`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const TYPE_LABEL: Record<string, string> = {
    EU: "EU",
    CHINA: "🇨🇳 China",
    OTHER: "Overig",
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <ShoppingCart className="w-4 h-4" />
        Inkoop maken
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Inkooporder aanmaken</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Leverancier
            </label>
            <div className="relative">
              <select
                value={supplierId}
                onChange={(e) => chooseSupplier(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white pr-8"
              >
                <option value="">— Kies leverancier —</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({TYPE_LABEL[s.supplierType] ?? s.supplierType})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {(!suppliers || suppliers.length === 0) && (
              <p className="text-xs text-slate-400 mt-2">
                Geen leveranciers gevonden. Voeg eerst leveranciers toe via het menu.
              </p>
            )}

            {/* Producten uit de deal */}
            {supplierId && dealProducts.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-600 mb-1.5">
                  Producten uit deze deal ({selectedCount} geselecteerd)
                </p>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {dealProducts.map((p) => {
                    const otherSupplier = p.supplierId && p.supplierId !== supplierId;
                    return (
                      <label
                        key={p.productId}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                          otherSupplier ? "opacity-60" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!selected[p.productId]}
                          onChange={(e) =>
                            setSelected((s) => ({ ...s, [p.productId]: e.target.checked }))
                          }
                          className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 truncate">{p.title}</p>
                          <p className="text-xs text-slate-400">
                            {p.sku}
                            {otherSupplier && p.supplierName ? ` · leverancier: ${p.supplierName}` : ""}
                          </p>
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={qtys[p.productId] ?? p.qty}
                          onChange={(e) =>
                            setQtys((q) => ({ ...q, [p.productId]: Number(e.target.value) }))
                          }
                          onClick={(e) => e.preventDefault()}
                          className="w-16 text-sm text-right border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                        />
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Producten van de gekozen leverancier staan standaard aangevinkt. Regels kun je later nog aanpassen.
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleCreate}
                disabled={!supplierId || loading}
                className="flex-1 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {loading
                  ? "Bezig…"
                  : selectedCount > 0
                  ? `Aanmaken met ${selectedCount} regel${selectedCount === 1 ? "" : "s"}`
                  : "Aanmaken (leeg)"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
