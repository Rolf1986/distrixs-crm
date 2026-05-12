"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, inputClass } from "@/components/ui/CreateModal";

const METHOD_OPTIONS = [
  { value: "BANK_TRANSFER", label: "Overboeking" },
  { value: "MOLLIE", label: "Mollie" },
  { value: "WERO", label: "Wero" },
  { value: "OTHER", label: "Overig" },
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  invoiceId: string;
  invoiceStatus: string;
  twinfieldLocked: boolean;
}

export function AddPaymentForm({ invoiceId, invoiceStatus, twinfieldLocked }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayString());
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");

  const locked = twinfieldLocked || invoiceStatus === "PAID" || invoiceStatus === "CREDITED";

  if (locked) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Vul een geldig bedrag in");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          paymentDate,
          method,
          reference: reference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Onbekende fout");
        return;
      }
      setAmount("");
      setPaymentDate(todayString());
      setMethod("BANK_TRANSFER");
      setReference("");
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Verbindingsfout, probeer opnieuw");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
        Betaling registreren
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Bedrag (€)" required>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
            />
          </FormField>
          <FormField label="Betaaldatum" required>
            <input
              type="date"
              className={inputClass}
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Betaalmethode">
            <select
              className={inputClass}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Referentie">
            <input
              type="text"
              className={inputClass}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optioneel"
            />
          </FormField>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
            Betaling succesvol geregistreerd
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? "Bezig…" : "Betaling registreren"}
          </button>
        </div>
      </form>
    </div>
  );
}
