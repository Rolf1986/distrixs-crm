"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Copy, Check } from "lucide-react";

export function MolliePaymentButton({
  invoiceId,
  invoiceNumber,
  openAmount,
  status,
}: {
  invoiceId: string;
  invoiceNumber: string;
  openAmount: number;
  status: string;
}) {
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Alleen tonen voor openstaande facturen
  if (status === "PAID" || status === "CREDITED" || openAmount <= 0) return null;

  async function generateLink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-link`, { method: "POST" });
      const data = await res.json() as { checkoutUrl?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Fout bij aanmaken betaallink");
        return;
      }
      setCheckoutUrl(data.checkoutUrl ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!checkoutUrl) return;
    await navigator.clipboard.writeText(checkoutUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (checkoutUrl) {
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Betaallink
        </a>
        <button
          onClick={copyLink}
          className="flex items-center gap-1 border border-slate-200 hover:border-slate-300 bg-white text-slate-600 text-sm px-2.5 py-2 rounded-lg transition-colors"
          title="Kopieer betaallink"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={generateLink}
        disabled={loading}
        className="flex items-center gap-1.5 border border-slate-200 hover:border-brand-blue/40 bg-white text-slate-700 hover:text-brand-blue text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
        title={`Mollie betaallink genereren voor € ${openAmount.toFixed(2)}`}
      >
        <CreditCard className="w-4 h-4" />
        {loading ? "Bezig…" : "Betaallink"}
      </button>
      {error && (
        <span className="text-xs text-red-500 max-w-48 truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
