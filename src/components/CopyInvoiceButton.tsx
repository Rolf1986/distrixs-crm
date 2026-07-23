"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";

export function CopyInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function copy() {
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/copy`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.id) {
        alert(data.error ?? "Kopiëren mislukt");
        return;
      }
      router.push(`/invoices/${data.id}/lines`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={copy}
      disabled={busy}
      className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      title="Kopieer deze factuur naar een nieuw concept"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
      Kopiëren
    </button>
  );
}
