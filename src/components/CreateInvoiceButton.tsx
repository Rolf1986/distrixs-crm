"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";

export function CreateInvoiceButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/invoices`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Fout bij aanmaken factuur");
        return;
      }
      const data = await res.json();
      router.push(`/invoices/${data.id}/lines`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
    >
      <Receipt className="w-4 h-4" />
      {loading ? "Bezig…" : "Factuur maken"}
    </button>
  );
}
