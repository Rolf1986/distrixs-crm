"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, Check, Loader2 } from "lucide-react";

// Verreken een creditnota met het openstaande bedrag van de gekoppelde factuur.
export function SettleCreditNoteButton({
  creditNoteId,
  settled,
  compact = false,
}: {
  creditNoteId: string;
  settled: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (settled) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-green-700 ${compact ? "text-xs" : "text-sm font-medium px-3 py-2"}`}
        title="Deze creditnota is verrekend met het openstaande bedrag van de factuur"
      >
        <Check className="w-3.5 h-3.5" />
        Verrekend
      </span>
    );
  }

  async function settle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/credit-notes/${creditNoteId}/settle`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Verrekenen mislukt");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={settle}
        disabled={busy}
        className={
          compact
            ? "inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline disabled:opacity-50"
            : "flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
        }
        title="Trek het creditbedrag af van het openstaande bedrag van de factuur"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
        Verrekenen met factuur
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
