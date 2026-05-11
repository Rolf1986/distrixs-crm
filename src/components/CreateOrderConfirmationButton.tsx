"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { CreateModal, FormField, inputClass } from "@/components/ui/CreateModal";

interface Props {
  dealId: string;
  quotes: { id: string; quoteNumber: string }[];
}

export function CreateOrderConfirmationButton({ dealId, quotes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setQuoteId("");
    setExpectedDelivery("");
    setNotes("");
    setError("");
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/order-confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, quoteId: quoteId || null, expectedDelivery: expectedDelivery || null, notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fout"); return; }
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <ClipboardCheck className="w-4 h-4" />
        Orderbevestiging maken
      </button>
      {open && (
        <CreateModal title="Nieuwe orderbevestiging" onClose={() => setOpen(false)} onSubmit={handleSubmit} loading={loading} error={error}>
          <FormField label="Gekoppelde offerte">
            <select className={inputClass} value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
              <option value="">— Geen offerte —</option>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>{q.quoteNumber}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Verwachte leverdatum">
            <input
              type="date"
              className={inputClass}
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
            />
          </FormField>
          <FormField label="Opmerkingen">
            <textarea
              className={`${inputClass} h-20 resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionele notities voor de klant..."
            />
          </FormField>
        </CreateModal>
      )}
    </>
  );
}
