"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CreateModal, FormField, inputClass } from "@/components/ui/CreateModal";

export function CreateCustomerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [kvkNumber, setKvkNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [paymentTerm, setPaymentTerm] = useState("DAYS_30");

  function reset() {
    setCompanyName(""); setKvkNumber(""); setVatNumber("");
    setStatus("ACTIVE"); setPaymentTerm("DAYS_30"); setError("");
  }

  async function handleSubmit() {
    setError("");
    if (!companyName.trim()) { setError("Bedrijfsnaam is verplicht"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          kvkNumber: kvkNumber.trim() || null,
          vatNumber: vatNumber.trim() || null,
          status,
          defaultPaymentTerm: paymentTerm,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fout bij aanmaken"); return; }
      setOpen(false);
      router.push(`/customers/${data.id}`);
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nieuwe klant
      </button>
      {open && (
        <CreateModal
          title="Nieuwe klant"
          onClose={() => setOpen(false)}
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
        >
          <FormField label="Bedrijfsnaam" required>
            <input
              className={inputClass}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme BV"
              autoFocus
            />
          </FormField>

          <FormField label="Status">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Actief</option>
              <option value="PROSPECT">Prospect</option>
              <option value="INACTIVE">Inactief</option>
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="KVK-nummer">
              <input
                className={inputClass}
                value={kvkNumber}
                onChange={(e) => setKvkNumber(e.target.value)}
                placeholder="12345678"
              />
            </FormField>
            <FormField label="BTW-nummer">
              <input
                className={inputClass}
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="NL123456789B01"
              />
            </FormField>
          </div>

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
