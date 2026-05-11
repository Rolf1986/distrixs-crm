"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LanguageToggle({
  documentType,
  documentId,
  currentLanguage,
}: {
  documentType: "quote" | "invoice" | "orderConfirmation" | "deliveryNote";
  documentId: string;
  currentLanguage: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const apiPath = {
    quote: `/api/quotes/${documentId}`,
    invoice: `/api/invoices/${documentId}`,
    orderConfirmation: `/api/order-confirmations/${documentId}`,
    deliveryNote: `/api/delivery-notes/${documentId}`,
  }[documentType];

  async function toggle(lang: string) {
    if (lang === currentLanguage) return;
    setLoading(true);
    await fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg overflow-hidden">
      {(["NL", "EN"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => toggle(lang)}
          disabled={loading}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            currentLanguage === lang
              ? "bg-brand-blue text-white"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
