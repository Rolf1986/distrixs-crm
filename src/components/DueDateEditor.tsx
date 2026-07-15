"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  invoiceId: string;
  /** ISO-datum van de huidige vervaldatum */
  value: string;
  locked?: boolean;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** ISO → yyyy-mm-dd voor <input type=date> */
function toInputDate(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function DueDateEditor({ invoiceId, value, locked }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(toInputDate(value));
  const [saving, setSaving] = useState(false);

  async function save(next: string) {
    if (!next) { setEditing(false); return; }
    setSaving(true);
    try {
      await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: next }),
      });
      router.refresh();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (locked) {
    return <span className="text-slate-400">· vervalt {fmt(value)}</span>;
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-slate-500">
        · vervalt{" "}
        <input
          type="date"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save(input);
            if (e.key === "Escape") { setInput(toInputDate(value)); setEditing(false); }
          }}
          disabled={saving}
          className="border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          autoFocus
        />
      </span>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-slate-400 hover:text-slate-700 transition-colors group"
      title="Klik om de vervaldatum aan te passen"
    >
      · vervalt{" "}
      <span className="group-hover:text-brand-blue font-medium text-slate-500">{fmt(value)}</span>
      <span className="ml-1 opacity-0 group-hover:opacity-100 text-slate-400 text-xs">✎</span>
    </button>
  );
}
