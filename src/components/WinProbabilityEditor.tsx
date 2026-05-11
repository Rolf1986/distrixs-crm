"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  dealId: string;
  value: number | null;
}

export function WinProbabilityEditor({ dealId, value }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value !== null && value !== undefined ? String(value) : "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setInput(value !== null && value !== undefined ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function save() {
    const num = parseInt(input, 10);
    const clamped = isNaN(num) ? null : Math.min(100, Math.max(0, num));
    setSaving(true);
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winProbability: clamped }),
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

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 text-sm">
        · <input
          ref={inputRef}
          type="number"
          min={0}
          max={100}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={save}
          disabled={saving}
          className="w-14 px-1.5 py-0.5 border border-blue-400 rounded text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          autoFocus
        />
        <span className="text-slate-500">% slaagkans</span>
      </span>
    );
  }

  if (value !== null && value !== undefined) {
    return (
      <button
        onClick={startEdit}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors group"
        title="Klik om te bewerken"
      >
        · <span className="font-medium text-slate-700 group-hover:text-brand-blue">{value}%</span>{" "}
        <span className="group-hover:text-blue-500">slaagkans</span>
        <span className="ml-1 opacity-0 group-hover:opacity-100 text-slate-400 text-xs">✎</span>
      </button>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
      title="Slaagkans instellen"
    >
      · slaagkans instellen…
    </button>
  );
}
