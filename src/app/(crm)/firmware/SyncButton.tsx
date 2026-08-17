"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

/**
 * Handmatige controle. De cron doet dit dagelijks; deze knop is voor als je
 * niet wilt wachten. `full` haalt alle ±102 pagina's op (eerste vulling).
 */
export function SyncButton({ full = false, label }: { full?: boolean; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const query = full ? "?pages=0&baseline=1" : "";
      const res = await fetch(`/api/firmware/sync${query}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error ?? "Controle mislukt");
        return;
      }
      setResult(
        data.newReleases === 0
          ? "Geen nieuwe firmware gevonden."
          : `${data.newReleases} nieuw · ${data.notificationsSent} mail${data.notificationsSent === 1 ? "" : "s"} verstuurd`
      );
      router.refresh();
    } catch {
      setResult("Verbindingsfout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {label}
      </button>
      {result && <span className="text-sm text-slate-500">{result}</span>}
    </div>
  );
}
