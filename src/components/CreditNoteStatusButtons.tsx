"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw, AlertTriangle, Undo2, HandCoins } from "lucide-react";

// Terugbetaald-markering voor een creditnota (voor creditnota's op al
// betaalde facturen, waar verrekenen met het openstaande bedrag niet kan).
export function RefundCreditNoteButton({
  creditNoteId,
  refunded,
  compact = false,
}: {
  creditNoteId: string;
  refunded: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle(method: "POST" | "DELETE") {
    setBusy(true);
    try {
      const res = await fetch(`/api/credit-notes/${creditNoteId}/refund`, { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Actie mislukt");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (refunded) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-green-700 ${compact ? "text-xs" : "text-sm font-medium"}`}>
        <Check className="w-3.5 h-3.5" />
        Terugbetaald
        {!compact && (
          <button
            onClick={() => toggle("DELETE")}
            disabled={busy}
            className="ml-1 text-xs text-slate-400 hover:text-slate-600 underline disabled:opacity-50"
            title="Markering ongedaan maken"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    );
  }

  return (
    <button
      onClick={() => toggle("POST")}
      disabled={busy}
      className={
        compact
          ? "inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline disabled:opacity-50"
          : "flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      }
      title="Markeer als terugbetaald aan de klant"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandCoins className="w-4 h-4" />}
      Terugbetaald
    </button>
  );
}

// Twinfield-boeking voor een creditnota (negatieve verkoopboeking).
export function CreditNoteTwinfieldButton({
  creditNoteId,
  syncStatus,
  reference,
}: {
  creditNoteId: string;
  syncStatus: "NOT_SYNCED" | "PENDING" | "SYNCED" | "ERROR";
  reference: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (syncStatus === "SYNCED") {
    return (
      <span
        className="flex items-center gap-1.5 border border-green-200 bg-green-50 text-green-700 text-sm font-medium px-3 py-2 rounded-lg"
        title={reference ? `Twinfield-boeking ${reference}` : "Geboekt in Twinfield"}
      >
        <Check className="w-4 h-4" />
        In Twinfield
      </span>
    );
  }

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/credit-notes/${creditNoteId}/twinfield-sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Boeken naar Twinfield mislukt");
      } else {
        router.refresh();
      }
    } catch {
      setError("Netwerkfout bij boeken naar Twinfield");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={sync}
        disabled={busy}
        className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
        title="Boek deze creditnota naar Twinfield"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {syncStatus === "ERROR" ? "Opnieuw naar Twinfield" : "Naar Twinfield"}
      </button>
      {error && (
        <span className="flex items-center gap-1 text-xs text-red-600 max-w-[280px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
