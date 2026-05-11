"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react";

interface Props {
  quoteId: string;
  currentStatus: string;
}

const transitions: Record<string, Array<{ status: string; label: string; icon: React.ReactNode; variant: string }>> = {
  DRAFT: [
    { status: "SENT", label: "Markeer als verzonden", icon: <Send className="w-4 h-4" />, variant: "blue" },
  ],
  SENT: [
    { status: "ACCEPTED", label: "Akkoord", icon: <CheckCircle className="w-4 h-4" />, variant: "green" },
    { status: "REJECTED", label: "Afgewezen", icon: <XCircle className="w-4 h-4" />, variant: "red" },
  ],
  REJECTED: [
    { status: "DRAFT", label: "Terugzetten naar concept", icon: <RotateCcw className="w-4 h-4" />, variant: "gray" },
  ],
};

const variantClasses: Record<string, string> = {
  blue:  "border border-brand-blue/30 bg-brand-blue-light text-brand-blue hover:bg-brand-blue-light",
  green: "border border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
  red:   "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
  gray:  "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
};

export function QuoteStatusActions({ quoteId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const available = transitions[currentStatus] ?? [];

  async function transition(status: string) {
    setLoading(status);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fout bij statuswijziging");
        return;
      }
      router.refresh();
    } catch {
      setError("Verbindingsfout");
    } finally {
      setLoading(null);
    }
  }

  if (available.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {available.map((t) => (
          <button
            key={t.status}
            onClick={() => transition(t.status)}
            disabled={!!loading}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[t.variant]}`}
          >
            {loading === t.status ? <Loader2 className="w-4 h-4 animate-spin" /> : t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
