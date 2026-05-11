"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DealStatus = "NEW" | "CONTACTED" | "MEETING_PLANNED" | "QUOTE_SENT" | "WON" | "LOST";

const STAGES: { key: DealStatus; label: string }[] = [
  { key: "NEW",             label: "Nieuw" },
  { key: "CONTACTED",       label: "Gecontacteerd" },
  { key: "MEETING_PLANNED", label: "Meeting gepland" },
  { key: "QUOTE_SENT",      label: "Offerte verstuurd" },
  { key: "WON",             label: "Gewonnen" },
];

const ORDER: DealStatus[] = ["NEW", "CONTACTED", "MEETING_PLANNED", "QUOTE_SENT", "WON"];

interface Props {
  dealId: string;
  status: string;
}

export function DealPipeline({ dealId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function setStage(newStatus: DealStatus) {
    if (newStatus === status) return;
    setLoading(newStatus);
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  if (status === "LOST") {
    return (
      <div className="flex items-center gap-2 px-1 py-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          Verloren
        </span>
      </div>
    );
  }

  const currentIdx = ORDER.indexOf(status as DealStatus);
  const busy = loading !== null;

  return (
    <div className="flex items-center gap-0 w-full py-3">
      {STAGES.map((stage, idx) => {
        const isPast    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isLast    = idx === STAGES.length - 1;
        const isLoading = loading === stage.key;

        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            {/* Stage dot + label */}
            <button
              onClick={() => setStage(stage.key)}
              disabled={busy || isCurrent}
              className={`flex flex-col items-center gap-1 shrink-0 group ${
                isCurrent ? "cursor-default" : "cursor-pointer"
              }`}
              title={isCurrent ? stage.label : `Zet op "${stage.label}"`}
            >
              <div
                className={`w-3 h-3 rounded-full border-2 transition-all ${
                  isLoading
                    ? "animate-pulse bg-brand-orange border-brand-orange"
                    : isPast
                    ? "bg-brand-blue border-brand-blue group-hover:scale-125"
                    : isCurrent
                    ? "bg-brand-blue border-blue-600 ring-2 ring-brand-blue-light"
                    : "bg-white border-slate-300 group-hover:border-brand-blue group-hover:scale-125"
                }`}
              />
              <span
                className={`text-xs whitespace-nowrap transition-colors ${
                  isCurrent
                    ? "text-brand-blue font-semibold"
                    : isPast
                    ? "text-slate-500 group-hover:text-brand-blue"
                    : "text-slate-400 group-hover:text-slate-600"
                }`}
              >
                {stage.label}
              </span>
            </button>
            {/* Connector line */}
            {!isLast && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${
                  isPast ? "bg-brand-blue" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
