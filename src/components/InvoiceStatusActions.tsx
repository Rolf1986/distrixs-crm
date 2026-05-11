"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CREDITED";

interface Props {
  invoiceId: string;
  currentStatus: InvoiceStatus;
  twinfieldLocked: boolean;
}

export function InvoiceStatusActions({ invoiceId, currentStatus, twinfieldLocked }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function transition(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Fout bij statuswijziging");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (twinfieldLocked) {
    return (
      <span className="text-xs text-slate-400 border border-slate-200 rounded px-2 py-1">
        🔒 Twinfield vergrendeld
      </span>
    );
  }

  const btnClass = (color: string) =>
    `flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${color}`;

  if (currentStatus === "DRAFT") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => transition("SENT")}
          disabled={loading}
          className={btnClass("bg-brand-blue hover:bg-brand-blue-dark text-white")}
        >
          {loading ? "..." : "Inboeken"}
        </button>
      </div>
    );
  }

  if (currentStatus === "SENT" || currentStatus === "OVERDUE") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => transition("PARTIALLY_PAID")}
          disabled={loading}
          className={btnClass("border border-orange-300 text-orange-700 hover:bg-orange-50")}
        >
          Gedeeltelijk betaald
        </button>
        <button
          onClick={() => transition("PAID")}
          disabled={loading}
          className={btnClass("bg-green-600 hover:bg-green-700 text-white")}
        >
          Betaald
        </button>
      </div>
    );
  }

  if (currentStatus === "PARTIALLY_PAID") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => transition("PAID")}
          disabled={loading}
          className={btnClass("bg-green-600 hover:bg-green-700 text-white")}
        >
          Volledig betaald
        </button>
        <button
          onClick={() => transition("SENT")}
          disabled={loading}
          className={btnClass("border border-slate-200 text-slate-500 hover:border-slate-300 text-xs")}
          title="Betaling terugdraaien"
        >
          ↩ Corrigeren
        </button>
      </div>
    );
  }

  if (currentStatus === "PAID") {
    return (
      <button
        onClick={() => transition("SENT")}
        disabled={loading}
        className={btnClass("border border-slate-200 text-slate-500 hover:border-slate-300 text-xs")}
        title="Markeer als niet betaald (voor correctie)"
      >
        ↩ Corrigeren
      </button>
    );
  }

  return null;
}
