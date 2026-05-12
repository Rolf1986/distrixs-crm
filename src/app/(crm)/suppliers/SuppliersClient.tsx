"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil, Check, X, Package, ShoppingCart } from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  supplierType: string;
  defaultCurrency: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  productCount: number;
  poCount: number;
};

const TYPE_LABEL: Record<string, string> = {
  EU: "🇪🇺 EU",
  CHINA: "🇨🇳 China",
  OTHER: "Overig",
};

const inputClass =
  "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white";

export function SuppliersClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New supplier form
  const blank = { name: "", supplierType: "EU", defaultCurrency: "EUR", email: "", phone: "", notes: "" };
  const [form, setForm] = useState(blank);

  // Edit form
  const [editForm, setEditForm] = useState<Partial<Supplier>>({});

  function handleForm(k: string, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function createSupplier() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          supplierType: form.supplierType,
          defaultCurrency: form.defaultCurrency,
          email: form.email || null,
          phone: form.phone || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) { alert("Fout bij aanmaken"); return; }
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
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setSuppliers((prev) =>
          prev.map((s) => s.id === id ? { ...s, ...updated } : s)
        );
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(supplier: Supplier) {
    await fetch(`/api/suppliers/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !supplier.isActive }),
    });
    setSuppliers((prev) =>
      prev.map((s) => s.id === supplier.id ? { ...s, isActive: !s.isActive } : s)
    );
    router.refresh();
  }

  const active = suppliers.filter((s) => s.isActive);
  const inactive = suppliers.filter((s) => !s.isActive);

  return (
    <div className="space-y-6">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Leverancier toevoegen
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-brand-blue/20 p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Nieuwe leverancier</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Naam *</label>
              <input className={`${inputClass} w-full`} value={form.name} onChange={(e) => handleForm("name", e.target.value)} placeholder="Leveranciersnaam" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Type</label>
              <select className={`${inputClass} w-full`} value={form.supplierType} onChange={(e) => handleForm("supplierType", e.target.value)}>
                <option value="EU">🇪🇺 EU</option>
                <option value="CHINA">🇨🇳 China</option>
                <option value="OTHER">Overig</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Valuta</label>
              <select className={`${inputClass} w-full`} value={form.defaultCurrency} onChange={(e) => handleForm("defaultCurrency", e.target.value)}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">E-mail</label>
              <input className={`${inputClass} w-full`} value={form.email} onChange={(e) => handleForm("email", e.target.value)} type="email" placeholder="contact@leverancier.nl" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Telefoon</label>
              <input className={`${inputClass} w-full`} value={form.phone} onChange={(e) => handleForm("phone", e.target.value)} placeholder="+31..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800">Annuleren</button>
            <button
              onClick={createSupplier}
              disabled={saving || !form.name.trim()}
              className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white font-medium px-4 py-2 rounded-lg text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Opslaan
            </button>
          </div>
        </div>
      )}

      {/* Active suppliers */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Naam</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valuta</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Producten</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO's</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {active.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Geen leveranciers</td></tr>
            )}
            {active.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                {editingId === s.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input className={`${inputClass} w-full`} value={editForm.name ?? s.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                    </td>
                    <td className="px-4 py-2">
                      <select className={inputClass} value={editForm.supplierType ?? s.supplierType} onChange={(e) => setEditForm((p) => ({ ...p, supplierType: e.target.value }))}>
                        <option value="EU">🇪🇺 EU</option>
                        <option value="CHINA">🇨🇳 China</option>
                        <option value="OTHER">Overig</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select className={inputClass} value={editForm.defaultCurrency ?? s.defaultCurrency} onChange={(e) => setEditForm((p) => ({ ...p, defaultCurrency: e.target.value }))}>
                        <option value="EUR">EUR</option><option value="USD">USD</option><option value="CNY">CNY</option><option value="GBP">GBP</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input className={`${inputClass} w-full`} value={editForm.email ?? s.email ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} type="email" />
                    </td>
                    <td colSpan={2} />
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(s.id)} disabled={saving} className="p-1.5 rounded bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-40">
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
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{TYPE_LABEL[s.supplierType] ?? s.supplierType}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{s.defaultCurrency}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.email ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-xs text-slate-500">
                        <Package className="w-3 h-3" />{s.productCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-xs text-slate-500">
                        <ShoppingCart className="w-3 h-3" />{s.poCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingId(s.id); setEditForm({}); }}
                          className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100"
                          title="Bewerken"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(s)}
                          className="px-2 py-1 rounded text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Deactiveren"
                        >
                          Deactiveer
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inactive */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Inactief ({inactive.length})</p>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50 opacity-60">
            {inactive.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-600">{s.name} <span className="text-xs text-slate-400">{TYPE_LABEL[s.supplierType]}</span></span>
                <button onClick={() => toggleActive(s)} className="text-xs text-brand-blue hover:underline">Activeer</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
