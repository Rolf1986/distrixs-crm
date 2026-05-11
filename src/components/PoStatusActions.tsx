"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PoStatus = "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CLOSED" | "CANCELLED";

export function PoStatusActions({ poId, currentStatus }: { poId: string; currentStatus: PoStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function transition(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/status`, {
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

  const btn = (label: string, status: string, color: string) => (
    <button
      key={status}
      onClick={() => transition(status)}
      disabled={loading}
      className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${color}`}
    >
      {label}
    </button>
  );

  if (currentStatus === "DRAFT") {
    return (
      <div className="flex gap-2">
        {btn("Besteld", "ORDERED", "bg-brand-blue hover:bg-brand-blue-dark text-white")}
        {btn("Annuleren", "CANCELLED", "border border-red-200 text-red-600 hover:bg-red-50")}
      </div>
    );
  }
  if (currentStatus === "ORDERED") {
    return (
      <div className="flex gap-2">
        {btn("Deels ontvangen", "PARTIALLY_RECEIVED", "border border-orange-300 text-orange-700 hover:bg-orange-50")}
        {btn("Ontvangen", "RECEIVED", "bg-green-600 hover:bg-green-700 text-white")}
      </div>
    );
  }
  if (currentStatus === "PARTIALLY_RECEIVED") {
    return btn("Volledig ontvangen", "RECEIVED", "bg-green-600 hover:bg-green-700 text-white");
  }
  if (currentStatus === "RECEIVED") {
    return btn("Sluiten", "CLOSED", "border border-slate-300 text-slate-600 hover:bg-slate-50");
  }
  return null;
}
