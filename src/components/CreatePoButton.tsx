"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, X, ChevronDown } from "lucide-react";

type Supplier = { id: string; name: string; supplierType: string };

export function CreatePoButton({
  dealId,
  suppliers,
}: {
  dealId: string;
  suppliers?: Supplier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!supplierId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId }),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
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
                onChange={(e) => setSupplierId(e.target.value)}
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

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleCreate}
                disabled={!supplierId || loading}
                className="flex-1 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {loading ? "Bezig…" : "Aanmaken"}
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
