"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Plus } from "lucide-react";

interface DealOption {
  id: string;
  dealNumber: string;
  title: string;
}

/**
 * Document (offerte/factuur) zonder deal → achteraf koppelen aan een
 * bestaande deal van de klant, of in één klik een nieuwe deal aanmaken
 * en koppelen. patchUrl krijgt een PATCH met { dealId }.
 */
export function DealLink({
  patchUrl,
  customerId,
  defaultTitle,
  deals,
}: {
  patchUrl: string;
  customerId: string;
  defaultTitle: string;
  deals: DealOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function linkDeal(dealId: string) {
    if (!dealId) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Koppelen mislukt");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function createAndLink() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: defaultTitle, customerId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.id) { setError(d.error ?? "Deal aanmaken mislukt"); return; }
      await linkDeal(d.id);
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-brand-blue transition-colors"
        title="Aan een deal koppelen"
      >
        <Link2 className="w-3.5 h-3.5" />
        deal koppelen…
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <select
        defaultValue=""
        onChange={(e) => linkDeal(e.target.value)}
        disabled={busy}
        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
      >
        <option value="">— Kies deal —</option>
        {deals.map((d) => (
          <option key={d.id} value={d.id}>{d.dealNumber} · {d.title}</option>
        ))}
      </select>
      <button
        onClick={createAndLink}
        disabled={busy}
        className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Nieuwe deal
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

/** Backwards-compatibele wrapper voor offertes. */
export function QuoteDealLink({
  quoteId,
  customerId,
  quoteTitle,
  deals,
}: {
  quoteId: string;
  customerId: string;
  quoteTitle: string;
  deals: DealOption[];
}) {
  return (
    <DealLink
      patchUrl={`/api/quotes/${quoteId}`}
      customerId={customerId}
      defaultTitle={quoteTitle}
      deals={deals}
    />
  );
}
