"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Eye } from "lucide-react";

export function ExcludeAccountButton({
  accountId,
  excluded,
}: {
  accountId: string;
  excluded: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (
      !excluded &&
      !confirm(
        "Dit account uitsluiten van analytics? Bestaande sessies en events van dit account worden gewist en nieuwe bezoeken worden niet meer geregistreerd."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/accounts/${accountId}/exclude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excluded: !excluded }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Er ging iets mis");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-700">
            {excluded ? "Uitgesloten van analytics" : "Eigen/intern account?"}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {excluded
              ? "Bezoeken van dit account worden niet geregistreerd."
              : "Sluit dit account uit zodat eigen bezoeken niet meetellen."}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors shrink-0 ${
            excluded
              ? "border-slate-200 text-slate-600 hover:bg-slate-50"
              : "border-red-200 text-red-600 hover:bg-red-50"
          } disabled:opacity-50`}
        >
          {excluded ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {excluded ? "Weer meetellen" : "Uitsluiten"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
