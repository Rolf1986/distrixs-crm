"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Loader2, X } from "lucide-react";

interface Props {
  dealId: string;
  type: "TASK" | "CALL" | "MEETING";
  label: string;
  icon: React.ReactNode;
  colorClass: string;
}

export function QuickActivityButton({ dealId, type, label, icon, colorClass }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function handleOpen() {
    // Default title suggestion
    setTitle(label);
    setDueAt("");
    setOpen(true);
    setDone(false);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/deals/${dealId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        }),
      });
      setDone(true);
      setOpen(false);
      setTitle("");
      setDueAt("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setOpen(false); }
  }

  if (done) {
    return (
      <button
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${colorClass} opacity-60`}
        disabled
      >
        <Check className="w-3.5 h-3.5" />
        {label} ✓
      </button>
    );
  }

  if (open) {
    return (
      <div className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 ${colorClass}`}>
        <span className="shrink-0">{icon}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`${label}…`}
          autoFocus
          className="text-sm bg-transparent border-none outline-none w-36 placeholder-current opacity-70"
        />
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 opacity-50" />
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-4"
              title="Deadline instellen"
            />
          </div>
          {dueAt && (
            <span className="text-xs opacity-70">
              {new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(dueAt))}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="shrink-0 disabled:opacity-40"
          title="Opslaan"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setOpen(false)} className="shrink-0 opacity-60 hover:opacity-100" title="Annuleren">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleOpen}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all hover:shadow-sm ${colorClass}`}
    >
      {icon}
      {label}
    </button>
  );
}
