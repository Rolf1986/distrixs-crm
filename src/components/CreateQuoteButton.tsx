"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";

export function CreateQuoteButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/quotes`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Onbekende fout");
        return;
      }
      router.push(`/quotes/${data.id}/lines`);
      router.refresh();
    } catch {
      setError("Verbindingsfout, probeer opnieuw");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleCreate}
        disabled={loading}
        className="flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        Offerte maken
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
