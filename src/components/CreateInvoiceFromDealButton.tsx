"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Loader2 } from "lucide-react";
import { CreateModal, FormField, inputClass } from "@/components/ui/CreateModal";

interface Props {
  dealId: string;
  customerId: string;
}

export function CreateInvoiceFromDealButton({ dealId, customerId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentTerm, setPaymentTerm] = useState("DAYS_30");

  function reset() { setPaymentTerm("DAYS_30"); setError(""); }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, dealId, paymentTerm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fout"); return; }
      router.push(`/invoices/${data.id}/lines`);
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Receipt className="w-4 h-4" />
        Nieuwe factuur
      </button>
      {open && (
        <CreateModal title="Nieuwe factuur" onClose={() => setOpen(false)} onSubmit={handleSubmit} loading={loading} error={error}>
          <FormField label="Betalingstermijn">
            <select className={inputClass} value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value)}>
              <option value="DAYS_14">14 dagen</option>
              <option value="DAYS_30">30 dagen</option>
              <option value="PREPAYMENT">Vooruitbetaling</option>
              <option value="INSTALLMENTS">In termijnen</option>
            </select>
          </FormField>
        </CreateModal>
      )}
    </>
  );
}
