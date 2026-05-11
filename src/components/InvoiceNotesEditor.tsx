"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";

interface Props {
  invoiceId: string;
  value: string | null;
  locked?: boolean;
}

export function InvoiceNotesEditor({ invoiceId, value, locked = false }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: text.trim() || null }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setText(value ?? "");
    setEditing(false);
  }

  if (locked) {
    return value ? (
      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 whitespace-pre-wrap">
        {value}
      </div>
    ) : null;
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group flex items-start gap-2 mt-4 w-full text-left"
      >
        <div className={`flex-1 min-h-[40px] px-3 py-2 rounded-lg border text-sm transition-colors ${
          value
            ? "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
            : "border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500"
        }`}>
          {value ? (
            <span className="whitespace-pre-wrap">{value}</span>
          ) : (
            "Opmerking toevoegen…"
          )}
        </div>
        <Pencil className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 mt-2 shrink-0 transition-colors" />
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        placeholder="Opmerking op de factuur (zichtbaar voor klant in PDF)"
        className="w-full rounded-lg border border-brand-blue/30 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white resize-none"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
        <button
          onClick={cancel}
          className="flex items-center gap-1.5 border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-lg hover:border-slate-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Annuleren
        </button>
      </div>
    </div>
  );
}
