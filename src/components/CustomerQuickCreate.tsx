"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Handshake, FileText, Receipt, Loader2 } from "lucide-react";

export function CustomerQuickCreate({ customerId, companyName }: { customerId: string; companyName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function createDeal() {
    setBusy("deal");
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: companyName, customerId }),
      });
      const data = await res.json();
      if (res.ok && data.id) router.push(`/deals/${data.id}`);
      else alert(data.error ?? "Aanmaken mislukt");
    } finally { setBusy(null); }
  }

  async function createQuote() {
    setBusy("quote");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json();
      if (res.ok && data.id) router.push(`/quotes/${data.id}/lines`);
      else alert(data.error ?? "Aanmaken mislukt");
    } finally { setBusy(null); }
  }

  async function createInvoice() {
    setBusy("invoice");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json();
      if (res.ok && data.id) router.push(`/invoices/${data.id}/lines`);
      else alert(data.error ?? "Aanmaken mislukt");
    } finally { setBusy(null); }
  }

  const base = "flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors border";

  return (
    <div className="flex items-center gap-2">
      <button onClick={createDeal} disabled={!!busy} className={`${base} border-slate-200 bg-white text-slate-700 hover:border-slate-300 disabled:opacity-50`}>
        {busy === "deal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" />}
        Deal
      </button>
      <button onClick={createQuote} disabled={!!busy} className={`${base} border-slate-200 bg-white text-slate-700 hover:border-slate-300 disabled:opacity-50`}>
        {busy === "quote" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Offerte
      </button>
      <button onClick={createInvoice} disabled={!!busy} className={`${base} border-transparent bg-brand-blue text-white hover:bg-brand-blue-dark disabled:opacity-50`}>
        {busy === "invoice" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
        Factuur
      </button>
    </div>
  );
}
