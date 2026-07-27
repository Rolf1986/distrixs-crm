"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Loader2, Check, X, Pencil } from "lucide-react";

/**
 * Vrij bericht op de offerte, zichtbaar voor de klant op de PDF
 * (bv. "Voor deze opdracht vragen wij 50% vooruitbetaling.").
 */
export function QuoteNoteEditor({ quoteId, value }: { quoteId: string; value: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicNote: input }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-3 bg-amber-50/60 border border-amber-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
          Bericht op offerte (zichtbaar voor klant)
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="bijv. Voor deze opdracht vragen wij 50% vooruitbetaling."
          className="w-full resize-none border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={() => { setInput(value ?? ""); setEditing(false); }}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700"
          >
            <X className="w-3.5 h-3.5" /> Annuleren
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Opslaan
          </button>
        </div>
      </div>
    );
  }

  if (value) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-3 w-full text-left bg-amber-50/60 border border-amber-200 rounded-lg p-3 group hover:border-amber-300 transition-colors"
        title="Klik om het bericht te bewerken"
      >
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1 flex items-center justify-between">
          Bericht op offerte (zichtbaar voor klant)
          <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-600" />
        </p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
      </button>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-amber-700 transition-colors"
    >
      <MessageSquarePlus className="w-4 h-4" />
      Bericht op offerte toevoegen… (bijv. vooruitbetaling)
    </button>
  );
}
