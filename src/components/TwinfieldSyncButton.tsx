"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";

type SyncStatus = "NOT_SYNCED" | "PENDING" | "SYNCED" | "ERROR";

interface Props {
  invoiceId: string;
  status: string; // factuurstatus (DRAFT/SENT/...)
  syncStatus: SyncStatus;
  reference: string | null;
}

export function TwinfieldSyncButton({ invoiceId, status, syncStatus, reference }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Een concept heeft nog geen definitief nummer → niet naar Twinfield boeken.
  if (status === "DRAFT") return null;

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/twinfield-sync`, {
        method: "POST",
      });
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

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={sync}
        disabled={busy}
        className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
        title="Deze factuur handmatig als concept-boeking naar Twinfield sturen"
      >
        {busy ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : syncStatus === "ERROR" ? (
          <AlertTriangle className="w-4 h-4 text-orange-500" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        {busy ? "Bezig…" : syncStatus === "ERROR" ? "Opnieuw naar Twinfield" : "Naar Twinfield"}
      </button>
      {error && <span className="text-xs text-red-600 max-w-[220px]">{error}</span>}
    </div>
  );
}
