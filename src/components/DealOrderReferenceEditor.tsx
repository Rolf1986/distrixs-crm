"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Order-/klantreferentie op de deal — komt op offerte, orderbevestiging en verzenddocument. */
export function DealOrderReferenceEditor({ dealId, value }: { dealId: string; value: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderReference: input.trim() || null }),
      });
      router.refresh();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 text-sm">
        · ref.{" "}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setInput(value ?? ""); setEditing(false); }
          }}
          onBlur={save}
          disabled={saving}
          placeholder="bijv. PO-2026-042"
          className="border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 w-40"
          autoFocus
        />
      </span>
    );
  }

  if (value) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors group"
        title="Order-/klantreferentie — komt op offerte, orderbevestiging en verzenddocument"
      >
        · ref.{" "}
        <span className="font-medium text-slate-700 group-hover:text-brand-blue">{value}</span>
        <span className="ml-1 opacity-0 group-hover:opacity-100 text-slate-400 text-xs">✎</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
      title="Order-/klantreferentie — komt op offerte, orderbevestiging en verzenddocument"
    >
      · orderreferentie instellen…
    </button>
  );
}
