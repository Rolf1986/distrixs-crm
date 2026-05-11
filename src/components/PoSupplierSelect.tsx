"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";

interface Props {
  poId: string;
  currentSupplierName: string;
  currentSupplierId: string;
  suppliers: { id: string; name: string; supplierType: string }[];
}

export function PoSupplierSelect({ poId, currentSupplierName, currentSupplierId, suppliers }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(currentSupplierId);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (selected === currentSupplierId) { setEditing(false); return; }
    setSaving(true);
    await fetch(`/api/purchase-orders/${poId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: selected }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-slate-600 hover:text-brand-blue group transition-colors"
      >
        <span className="font-medium">{currentSupplierName}</span>
        <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        autoFocus
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
      >
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving}
        className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => { setSelected(currentSupplierId); setEditing(false); }}
        className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
