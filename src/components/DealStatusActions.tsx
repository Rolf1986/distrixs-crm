"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DealStatus = "NEW" | "CONTACTED" | "MEETING_PLANNED" | "QUOTE_SENT" | "WON" | "LOST";

export function DealStatusActions({ dealId, currentStatus }: { dealId: string; currentStatus: DealStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function setStatus(status: DealStatus) {
    setLoading(status);
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const isOpen = currentStatus !== "WON" && currentStatus !== "LOST";
  const isWon  = currentStatus === "WON";
  const isLost = currentStatus === "LOST";
  const busy   = loading !== null;

  return (
    <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
      {/* Open — alleen zichtbaar als WON of LOST om te heropenen */}
      <button
        onClick={() => setStatus("NEW")}
        disabled={busy || isOpen}
        style={{
          backgroundColor: isOpen ? "#1e293b" : undefined,
          color: isOpen ? "#fff" : undefined,
        }}
        className={`px-3 py-1.5 transition-colors border-r border-slate-200 ${
          isOpen
            ? "cursor-default"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        {busy && !isLost && !isWon ? "..." : "Open"}
      </button>

      <button
        onClick={() => setStatus("LOST")}
        disabled={busy || isLost}
        style={isLost ? { backgroundColor: "#dc2626", color: "#fff" } : undefined}
        className={`px-3 py-1.5 transition-colors border-r border-slate-200 ${
          isLost
            ? "cursor-default"
            : "text-slate-600 hover:bg-red-50 hover:text-red-700"
        }`}
      >
        {loading === "LOST" ? "..." : "Verloren"}
      </button>

      <button
        onClick={() => setStatus("WON")}
        disabled={busy || isWon}
        style={isWon ? { backgroundColor: "#16a34a", color: "#fff" } : undefined}
        className={`px-3 py-1.5 transition-colors ${
          isWon
            ? "cursor-default"
            : "text-slate-600 hover:bg-green-50 hover:text-green-700"
        }`}
      >
        {loading === "WON" ? "..." : "Gewonnen"}
      </button>
    </div>
  );
}
