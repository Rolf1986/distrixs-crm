"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, Pencil, Check, X, Search, ChevronDown, ChevronRight, Layers, Trash2, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type PriceTier = {
  id: string;
  minQty: number;
  maxQty: number | null;
  unitPrice: number;
};

type Product = {
  id: string;
  sku: string;
  title: string;
  supplierId: string;
  supplierName: string;
  supplierType: string;
  advisorySellPrice: number;
  baseCostPrice: number;
  unit: string;
  isActive: boolean;
  dealLineCount: number;
  priceTiers: PriceTier[];
};

type Supplier = {
  id: string;
  name: string;
  supplierType: string;
};

const inputClass =
  "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white";

const SUPPLIER_TYPE_COLOR: Record<string, string> = {
  EU: "bg-brand-blue-light text-brand-blue",
  CHINA: "bg-orange-50 text-orange-700",
  OTHER: "bg-slate-100 text-slate-600",
};

// ─── Price tiers panel ──────────────────────────────────────────────────────

function PriceTiersPanel({ product, onUpdate }: { product: Product; onUpdate: (tiers: PriceTier[]) => void }) {
  const [tiers, setTiers] = useState<PriceTier[]>(product.priceTiers);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ minQty: "", maxQty: "", unitPrice: "" });

  async function addTier() {
    if (!form.minQty || !form.unitPrice) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}/price-tiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minQty: Number(form.minQty),
          maxQty: form.maxQty ? Number(form.maxQty) : null,
          unitPrice: Number(form.unitPrice),
        }),
      });
      if (res.ok) {
        const tier = await res.json();
        const updated = [...tiers, tier].sort((a, b) => a.minQty - b.minQty);
        setTiers(updated);
        onUpdate(updated);
        setForm({ minQty: "", maxQty: "", unitPrice: "" });
        setAdding(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteTier(tierId: string) {
    await fetch(`/api/products/${product.id}/price-tiers/${tierId}`, { method: "DELETE" });
    const updated = tiers.filter((t) => t.id !== tierId);
    setTiers(updated);
    onUpdate(updated);
  }

  return (
    <div className="px-4 pb-4 pt-1 bg-slate-50 border-t border-slate-100">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Staffelprijzen
          </p>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-brand-blue hover:text-brand-blue-dark font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Rij toevoegen
          </button>
        </div>

        {tiers.length === 0 && !adding && (
          <p className="text-xs text-slate-400 italic">Geen staffelprijzen — standaard verkoopprijs wordt gebruikt.</p>
        )}

        {tiers.length > 0 && (
          <table className="w-full text-xs mb-2">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5 pr-4 text-slate-500 font-medium">Vanaf stuks</th>
                <th className="text-left py-1.5 pr-4 text-slate-500 font-medium">t/m stuks</th>
                <th className="text-right py-1.5 text-slate-500 font-medium">Stukprijs</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tiers.map((t) => (
                <tr key={t.id}>
                  <td className="py-1.5 pr-4 text-slate-700 font-medium">{t.minQty}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{t.maxQty ?? "∞"}</td>
                  <td className="py-1.5 text-right text-slate-900 font-medium">{formatCurrency(t.unitPrice)}</td>
                  <td className="py-1.5 pl-3">
                    <button
                      onClick={() => deleteTier(t.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {adding && (
          <div className="flex items-center gap-2 mt-2">
            <div>
              <label className="block text-xs text-slate-400 mb-0.5">Vanaf</label>
              <input
                className={`${inputClass} w-20 py-1.5 text-xs`}
                type="number"
                min="1"
                placeholder="1"
                value={form.minQty}
                onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-0.5">t/m (optioneel)</label>
              <input
                className={`${inputClass} w-20 py-1.5 text-xs`}
                type="number"
                min="1"
                placeholder="∞"
                value={form.maxQty}
                onChange={(e) => setForm((f) => ({ ...f, maxQty: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-0.5">Stukprijs (€)</label>
              <input
                className={`${inputClass} w-28 py-1.5 text-xs`}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              />
            </div>
            <div className="flex gap-1 mt-4">
              <button
                onClick={addTier}
                disabled={saving || !form.minQty || !form.unitPrice}
                className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => { setAdding(false); setForm({ minQty: "", maxQty: "", unitPrice: "" }); }}
                className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ProductsClient({
  initialProducts,
  suppliers,
}: {
  initialProducts: Product[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const blank = {
    sku: "", title: "", supplierId: suppliers[0]?.id ?? "",
    advisorySellPrice: "", baseCostPrice: "", unit: "stuk",
  };
  const [form, setForm] = useState(blank);

  const filtered = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(search.toLowerCase())
  );

  const active = filtered.filter((p) => p.isActive);
  const inactive = filtered.filter((p) => !p.isActive);

  async function createProduct() {
    if (!form.sku.trim() || !form.title.trim() || !form.supplierId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: form.sku.trim(),
          title: form.title.trim(),
          supplierId: form.supplierId,
          advisorySellPrice: Number(form.advisorySellPrice) || 0,
          baseCostPrice: Number(form.baseCostPrice) || 0,
          unit: form.unit || "stuk",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Fout bij aanmaken");
        return;
      }
      setForm(blank);
      setShowForm(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          advisorySellPrice: editForm.advisorySellPrice != null ? Number(editForm.advisorySellPrice) : undefined,
          baseCostPrice: editForm.baseCostPrice != null ? Number(editForm.baseCostPrice) : undefined,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...editForm,
                  advisorySellPrice: Number(updated.advisorySellPrice),
                  baseCostPrice: Number(updated.baseCostPrice),
                  supplierName: suppliers.find((s) => s.id === (editForm.supplierId ?? p.supplierId))?.name ?? p.supplierName,
                  supplierType: suppliers.find((s) => s.id === (editForm.supplierId ?? p.supplierId))?.supplierType ?? p.supplierType,
                }
              : p
          )
        );
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, isActive: !x.isActive } : x));
    router.refresh();
  }

  function updateTiers(productId: string, tiers: PriceTier[]) {
    setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, priceTiers: tiers } : p));
  }

  const margin = (p: Product) => {
    if (p.advisorySellPrice === 0) return null;
    return ((p.advisorySellPrice - p.baseCostPrice) / p.advisorySellPrice) * 100;
  };

  const COLS = 10; // colspan for empty rows / expanded panels

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className={`${inputClass} pl-9 w-full`}
            placeholder="Zoek op naam, SKU of leverancier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Product toevoegen
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-brand-blue/20 p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Nieuw product</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">SKU *</label>
              <input className={`${inputClass} w-full`} value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} placeholder="PROD-001" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Naam *</label>
              <input className={`${inputClass} w-full`} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Productnaam" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Leverancier *</label>
              <select className={`${inputClass} w-full`} value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Verkoopprijs (€)</label>
              <input className={`${inputClass} w-full`} type="number" step="0.01" min="0" value={form.advisorySellPrice} onChange={(e) => setForm((p) => ({ ...p, advisorySellPrice: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Inkoopprijs (€)</label>
              <input className={`${inputClass} w-full`} type="number" step="0.01" min="0" value={form.baseCostPrice} onChange={(e) => setForm((p) => ({ ...p, baseCostPrice: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Eenheid</label>
              <input className={`${inputClass} w-full`} value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} placeholder="stuk" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm text-slate-600">Annuleren</button>
            <button
              onClick={createProduct}
              disabled={saving || !form.sku.trim() || !form.title.trim()}
              className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white font-medium px-4 py-2 rounded-lg text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Opslaan
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="w-8 px-4 py-3" />
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Naam</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Leverancier</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Verkoopprijs</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Inkoopprijs</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Marge</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Eenheid</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Staffel</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Gebruikt</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {active.length === 0 && (
              <tr><td colSpan={COLS} className="px-4 py-8 text-center text-slate-400">Geen producten gevonden</td></tr>
            )}
            {active.map((p) => {
              const m = margin(p);
              const expanded = expandedId === p.id;
              return (
                <>
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50 transition-colors ${expanded ? "bg-slate-50" : ""}`}
                  >
                    {editingId === p.id ? (
                      <>
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2"><input className={`${inputClass} w-24`} value={editForm.sku ?? p.sku} onChange={(e) => setEditForm((x) => ({ ...x, sku: e.target.value }))} /></td>
                        <td className="px-4 py-2"><input className={`${inputClass} w-full`} value={editForm.title ?? p.title} onChange={(e) => setEditForm((x) => ({ ...x, title: e.target.value }))} /></td>
                        <td className="px-4 py-2">
                          <select className={inputClass} value={editForm.supplierId ?? p.supplierId} onChange={(e) => setEditForm((x) => ({ ...x, supplierId: e.target.value }))}>
                            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2"><input className={`${inputClass} w-28`} type="number" step="0.01" value={editForm.advisorySellPrice ?? p.advisorySellPrice} onChange={(e) => setEditForm((x) => ({ ...x, advisorySellPrice: Number(e.target.value) }))} /></td>
                        <td className="px-4 py-2"><input className={`${inputClass} w-28`} type="number" step="0.01" value={editForm.baseCostPrice ?? p.baseCostPrice} onChange={(e) => setEditForm((x) => ({ ...x, baseCostPrice: Number(e.target.value) }))} /></td>
                        <td colSpan={2} className="px-4 py-2"><input className={`${inputClass} w-20`} value={editForm.unit ?? p.unit} onChange={(e) => setEditForm((x) => ({ ...x, unit: e.target.value }))} /></td>
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(p.id)} disabled={saving} className="p-1.5 rounded bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-40">
                              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Expand toggle */}
                        <td className="px-4 py-3 w-8">
                          <button
                            onClick={() => setExpandedId(expanded ? null : p.id)}
                            className="text-slate-300 hover:text-slate-500 transition-colors"
                            title="Staffelprijzen beheren"
                          >
                            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.sku}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${SUPPLIER_TYPE_COLOR[p.supplierType] ?? "bg-slate-100 text-slate-600"}`}>
                            {p.supplierType === "CHINA" ? "🇨🇳 " : p.supplierType === "EU" ? "🇪🇺 " : ""}{p.supplierName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(p.advisorySellPrice)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(p.baseCostPrice)}</td>
                        <td className="px-4 py-3 text-right">
                          {m != null ? (
                            <span className={`text-xs font-medium ${m >= 30 ? "text-green-600" : m >= 15 ? "text-orange-600" : "text-red-600"}`}>
                              {m.toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{p.unit}</td>
                        <td className="px-4 py-3 text-center">
                          {p.priceTiers.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-violet-700 font-medium bg-violet-50 px-2 py-0.5 rounded-full">
                              <Layers className="w-3 h-3" />
                              {p.priceTiers.length}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 text-xs">{p.dealLineCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Link
                              href={`/products/${p.id}/sales`}
                              className="p-1.5 rounded text-slate-300 hover:text-brand-blue hover:bg-blue-50"
                              title="Verkopen: aan wie is dit product verkocht?"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => { setEditingId(p.id); setEditForm({}); }}
                              className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleActive(p)}
                              className="px-2 py-1 rounded text-xs text-slate-300 hover:text-red-500 hover:bg-red-50"
                            >
                              Deactiveer
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  {/* Expanded price tiers row */}
                  {expanded && editingId !== p.id && (
                    <tr key={`${p.id}-tiers`}>
                      <td colSpan={COLS + 1} className="p-0">
                        <PriceTiersPanel
                          product={p}
                          onUpdate={(tiers) => updateTiers(p.id, tiers)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Inactive */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Inactief ({inactive.length})</p>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50 opacity-60">
            {inactive.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  <span className="font-mono text-xs text-slate-400 mr-2">{p.sku}</span>
                  {p.title}
                </span>
                <button onClick={() => toggleActive(p)} className="text-xs text-brand-blue hover:underline">Activeer</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
