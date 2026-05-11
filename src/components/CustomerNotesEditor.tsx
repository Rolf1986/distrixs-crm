"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  customerId: string;
  initialNotes: string;
}

export function CustomerNotesEditor({ customerId, initialNotes }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isDirty = notes !== initialNotes;

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        rows={5}
        placeholder="Voeg achtergrondinformatie toe over dit bedrijf…"
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none text-slate-700 placeholder-slate-400"
      />
      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="text-xs text-green-600 font-medium">✓ Opgeslagen</span>
        )}
        {isDirty && (
          <button
            onClick={save}
            disabled={saving}
            className="text-xs bg-brand-blue hover:bg-brand-blue-dark text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        )}
      </div>
    </div>
  );
}
