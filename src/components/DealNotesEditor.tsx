"use client";

import { useState } from "react";

interface Props {
  dealId: string;
  initialNotes: string;
}

export function DealNotesEditor({ dealId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = notes !== initialNotes;

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Opmerkingen</h3>
        {saved && (
          <span className="text-xs text-green-600 font-medium">✓ Opgeslagen</span>
        )}
      </div>
      <div className="p-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Interne opmerkingen over deze deal…"
          rows={8}
          className="w-full text-sm text-slate-700 placeholder-slate-300 resize-none focus:outline-none"
        />
      </div>
      {dirty && (
        <div className="px-4 pb-3 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      )}
    </div>
  );
}
