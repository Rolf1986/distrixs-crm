"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface Props {
  dealId: string;
  currentCustomerId: string;
  currentCustomerName: string;
  customers: { id: string; companyName: string; customerNumber: string }[];
}

export function DealCustomerSelect({ dealId, currentCustomerId, currentCustomerName, customers }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(currentCustomerId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (selected === currentCustomerId) { setEditing(false); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selected }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Wijzigen mislukt");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5 group">
        <Link href={`/customers/${currentCustomerId}`} className="text-sm text-brand-blue hover:underline">
          {currentCustomerName}
        </Link>
        <button
          onClick={() => setEditing(true)}
          title="Klant wijzigen"
          className="text-slate-400 hover:text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <SearchableSelect
          options={customers.map((c) => ({ id: c.id, label: c.companyName, sub: c.customerNumber }))}
          value={selected}
          onChange={setSelected}
          placeholder="Zoek klant…"
          className="w-64"
        />
        <button
          onClick={save}
          disabled={saving}
          className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { setSelected(currentCustomerId); setEditing(false); setError(null); }}
          className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Concept-documenten verhuizen mee; verzonden documenten blijven bij de huidige klant.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
