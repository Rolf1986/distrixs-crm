"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  quoteId: string;
  value: Date | string | null;
}

function toInputDate(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function formatNL(d: Date | string | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export function ValidUntilEditor({ quoteId, value }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(toInputDate(value));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validUntil: input ? new Date(input).toISOString() : null,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setEditing(false);
  }

  const isExpired = value && new Date(value) < new Date();

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 text-sm">
        · geldig t/m{" "}
        <input
          type="date"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={save}
          disabled={saving}
          className="border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          autoFocus
        />
      </span>
    );
  }

  if (value) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`text-sm transition-colors group ${
          isExpired ? "text-red-500" : "text-slate-500 hover:text-slate-700"
        }`}
        title="Klik om te bewerken"
      >
        · geldig t/m{" "}
        <span
          className={`font-medium ${
            isExpired
              ? "text-red-600"
              : "text-slate-700 group-hover:text-brand-blue"
          }`}
        >
          {formatNL(value)}
        </span>
        {isExpired && <span className="ml-1 text-xs">⚠</span>}
        <span className="ml-1 opacity-0 group-hover:opacity-100 text-slate-400 text-xs">
          ✎
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
      title="Geldigheidsdatum instellen"
    >
      · geldigheidsdatum instellen…
    </button>
  );
}
