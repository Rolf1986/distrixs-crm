"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Trash2, Loader2, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Pricelist = {
  id: string;
  productId: string;
  fixedPrice: number | null;
  discountPct: number | null;
  validFrom: string | null;
  validUntil: string | null;
  product: { title: string; sku: string };
};

type Product = {
  id: string;
  title: string;
  sku: string;
  advisorySellPrice: number;
};

const inputClass =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white w-full";

export default function CustomerPricelistsPage() {
  const { id: customerId } = useParams<{ id: string }>();

  const [pricelists, setPricelists] = useState<Pricelist[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    productId: "",
    priceType: "fixedPrice" as "fixedPrice" | "discountPct",
    fixedPrice: "",
    discountPct: "",
    validFrom: "",
    validUntil: "",
  });
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [plRes, prodRes] = await Promise.all([
      fetch(`/api/customers/${customerId}/pricelists`),
      fetch("/api/products?active=1"),
    ]);
    if (plRes.ok) setPricelists(await plRes.json());
    if (prodRes.ok) {
      const data = await prodRes.json();
      // products route may return array directly or { products: [] }
      setProducts(Array.isArray(data) ? data : data.products ?? []);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function deletePricelist(id: string) {
    if (!confirm("Verwijder deze prijsregel?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/customers/${customerId}/pricelists/${id}`, { method: "DELETE" });
      setPricelists((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.productId) { setFormError("Selecteer een product"); return; }
    if (form.priceType === "fixedPrice" && !form.fixedPrice) {
      setFormError("Vaste prijs is verplicht"); return;
    }
    if (form.priceType === "discountPct" && !form.discountPct) {
      setFormError("Kortingspercentage is verplicht"); return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        productId: form.productId,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      };
      if (form.priceType === "fixedPrice") {
        body.fixedPrice = Number(form.fixedPrice);
      } else {
        body.discountPct = Number(form.discountPct);
      }

      const res = await fetch(`/api/customers/${customerId}/pricelists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? "Opslaan mislukt");
        return;
      }
      setForm({ productId: "", priceType: "fixedPrice", fixedPrice: "", discountPct: "", validFrom: "", validUntil: "" });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function fmt(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("nl-NL");
  }

  const selectedProduct = products.find((p) => p.id === form.productId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Klantspecifieke prijslijst
          {pricelists.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400">{pricelists.length} {pricelists.length === 1 ? "regel" : "regels"}</span>
          )}
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue-dark transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Regel toevoegen
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Nieuwe prijsregel</h3>
          <form onSubmit={submitForm} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Product */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Product</label>
                <select
                  className={inputClass}
                  value={form.productId}
                  onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                >
                  <option value="">-- kies product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} – {p.title}</option>
                  ))}
                </select>
                {selectedProduct && (
                  <p className="text-xs text-slate-400 mt-1">
                    Adviesprijs: {formatCurrency(selectedProduct.advisorySellPrice)}
                  </p>
                )}
              </div>

              {/* Price type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Type korting</label>
                <select
                  className={inputClass}
                  value={form.priceType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priceType: e.target.value as "fixedPrice" | "discountPct" }))
                  }
                >
                  <option value="fixedPrice">Vaste prijs</option>
                  <option value="discountPct">Kortingspercentage</option>
                </select>
              </div>

              {/* Price value */}
              {form.priceType === "fixedPrice" ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vaste prijs (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    placeholder="0.00"
                    value={form.fixedPrice}
                    onChange={(e) => setForm((f) => ({ ...f, fixedPrice: e.target.value }))}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Kortings % (bijv. 10)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className={inputClass}
                    placeholder="10.00"
                    value={form.discountPct}
                    onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
                  />
                </div>
              )}

              {/* Valid from */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Geldig van</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                />
              </div>

              {/* Valid until */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Geldig tot</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.validUntil}
                  onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue-dark disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Opslaan
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(""); }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : pricelists.length === 0 ? (
          <p className="px-6 py-10 text-sm text-slate-400 text-center">
            Geen klantspecifieke prijzen ingesteld
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">SKU</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Vaste prijs</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Korting %</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Geldig van</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Geldig tot</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pricelists.map((pl) => (
                <tr key={pl.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{pl.product.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{pl.product.sku}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {pl.fixedPrice != null ? formatCurrency(pl.fixedPrice) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {pl.discountPct != null ? `${pl.discountPct}%` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmt(pl.validFrom)}</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(pl.validUntil)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deletePricelist(pl.id)}
                      disabled={deletingId === pl.id}
                      className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      {deletingId === pl.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
