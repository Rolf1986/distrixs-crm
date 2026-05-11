"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CreateModal, FormField, inputClass } from "@/components/ui/CreateModal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface Props {
  customers: { id: string; companyName: string }[];
  deals: { id: string; dealNumber: string; title: string }[];
}

export function CreateInvoiceStandaloneButton({ customers, deals }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dealId, setDealId] = useState("");
  const [paymentTerm, setPaymentTerm] = useState("DAYS_30");

  function reset() { setCustomerId(""); setDealId(""); setPaymentTerm("DAYS_30"); setError(""); }

  async function handleSubmit() {
    setError("");
    if (!customerId) { setError("Klant is verplicht"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, dealId: dealId || undefined, paymentTerm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fout bij aanmaken"); return; }
      setOpen(false);
      router.push(`/invoices/${data.id}/lines`);
      router.refresh();
    } finally { setLoading(false); }
  }

  const customerOptions = customers.map((c) => ({ id: c.id, label: c.companyName }));
  const dealOptions = deals.map((d) => ({ id: d.id, label: d.title, sub: d.dealNumber }));

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nieuwe factuur
      </button>
      {open && (
        <CreateModal title="Nieuwe factuur" onClose={() => setOpen(false)} onSubmit={handleSubmit} loading={loading} error={error}>
          <FormField label="Klant" required>
            <SearchableSelect
              options={customerOptions}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Zoek en selecteer klant…"
            />
          </FormField>
          <FormField label="Koppelen aan deal">
            <SearchableSelect
              options={dealOptions}
              value={dealId}
              onChange={setDealId}
              placeholder="— Geen deal —"
            />
          </FormField>
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
