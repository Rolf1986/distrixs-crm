"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Loader2 } from "lucide-react";

// Serienummers per factuurregel. Plak gerust een hele lijst (één per regel,
// komma's, of rechtstreeks uit Excel) — de server normaliseert. Mag ook op
// verzonden facturen (raakt geen bedragen).
export function SerialNumbersEditor({
  invoiceId,
  lineId,
  initial,
}: {
  invoiceId: string;
  lineId: string;
  initial: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);

  const count = saved ? saved.split("\n").filter(Boolean).length : 0;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumbers: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Opslaan mislukt");
        return;
      }
      const line = await res.json();
      setSaved(line.serialNumbers ?? "");
      setValue(line.serialNumbers ?? "");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 text-xs mt-0.5 ${
          count > 0 ? "text-slate-500 hover:text-brand-blue" : "text-slate-300 hover:text-slate-500"
        }`}
        title="Serienummers bewerken"
      >
        <Hash className="w-3 h-3" />
        {count > 0 ? `${count} serienummer${count !== 1 ? "s" : ""}` : "serienummers"}
      </button>
    );
  }

  return (
    <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
      <textarea
        autoFocus
        rows={Math.min(10, Math.max(3, value.split("\n").length + 1))}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
        placeholder={"Plak hier de serienummers — één per regel,\nmet komma's, of rechtstreeks uit Excel"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={save}
          disabled={busy}
          className="text-xs bg-brand-blue hover:bg-brand-blue-dark text-white px-2.5 py-1 rounded disabled:opacity-50 inline-flex items-center gap-1"
        >
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
          Opslaan
        </button>
        <button
          onClick={() => {
            setValue(saved);
            setOpen(false);
          }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Annuleren
        </button>
        <span className="text-xs text-slate-400 ml-auto">
          {value.trim() ? `${value.split(/[\n\r,;\t]+/).filter((s) => s.trim()).length} nummers` : ""}
        </span>
      </div>
    </div>
  );
}
