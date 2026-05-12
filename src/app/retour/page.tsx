"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "Defect product",
  WRONG_PRODUCT: "Verkeerd product geleverd",
  DAMAGED: "Beschadigd bij levering",
  NOT_AS_DESCRIBED: "Niet zoals beschreven",
  CHANGED_MIND: "Van gedachten veranderd",
  OTHER: "Anders",
};

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export default function RmaFormPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    submittedName: "",
    submittedEmail: "",
    submittedPhone: "",
    submittedCompany: "",
    orderReference: "",
    productDescription: "",
    serialNumber: "",
    purchaseDate: "",
    quantity: "1",
    reason: "",
    description: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/rma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Er is iets misgegaan.");
        return;
      }
      router.push(`/retour/bedankt?nr=${data.rmaNumber}`);
    } catch {
      setError("Verbindingsfout. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Retourverzoek (RMA)</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Vul het formulier in om een retour of klacht te melden. We nemen zo snel mogelijk contact
          met je op.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contactgegevens */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Contactgegevens
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Naam" required>
              <input
                className={inputClass}
                value={form.submittedName}
                onChange={(e) => set("submittedName", e.target.value)}
                placeholder="Jan de Vries"
                required
              />
            </Field>
            <Field label="Bedrijfsnaam">
              <input
                className={inputClass}
                value={form.submittedCompany}
                onChange={(e) => set("submittedCompany", e.target.value)}
                placeholder="Bedrijf BV"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="E-mailadres" required>
              <input
                type="email"
                className={inputClass}
                value={form.submittedEmail}
                onChange={(e) => set("submittedEmail", e.target.value)}
                placeholder="jan@bedrijf.nl"
                required
              />
            </Field>
            <Field label="Telefoonnummer">
              <input
                type="tel"
                className={inputClass}
                value={form.submittedPhone}
                onChange={(e) => set("submittedPhone", e.target.value)}
                placeholder="+31 6 12345678"
              />
            </Field>
          </div>
        </div>

        {/* Productinformatie */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Productinformatie
          </h2>
          <Field
            label="Productnaam / omschrijving"
            required
            hint="Beschrijf het product zo duidelijk mogelijk."
          >
            <input
              className={inputClass}
              value={form.productDescription}
              onChange={(e) => set("productDescription", e.target.value)}
              placeholder="bijv. Draadloze speaker model XYZ"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ordernummer / factuurnummer" hint="bijv. F-2024-042 of uw eigen referentie">
              <input
                className={inputClass}
                value={form.orderReference}
                onChange={(e) => set("orderReference", e.target.value)}
                placeholder="F-2024-042"
              />
            </Field>
            <Field label="Serienummer">
              <input
                className={inputClass}
                value={form.serialNumber}
                onChange={(e) => set("serialNumber", e.target.value)}
                placeholder="SN-XXXXXX"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Aankoopdatum">
              <input
                type="date"
                className={inputClass}
                value={form.purchaseDate}
                onChange={(e) => set("purchaseDate", e.target.value)}
              />
            </Field>
            <Field label="Aantal" required>
              <input
                type="number"
                min="1"
                className={inputClass}
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                required
              />
            </Field>
          </div>
        </div>

        {/* Retourinformatie */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Reden van retour
          </h2>
          <Field label="Reden" required>
            <select
              className={inputClass}
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              required
            >
              <option value="">Selecteer een reden…</option>
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Toelichting"
            required
            hint="Beschrijf het probleem zo uitgebreid mogelijk."
          >
            <textarea
              className={`${inputClass} resize-none`}
              rows={5}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Geef een duidelijke beschrijving van het probleem…"
              required
            />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white font-medium py-3 px-6 rounded-lg text-sm transition-colors"
        >
          {loading ? "Bezig met versturen…" : "Retourverzoek indienen"}
        </button>
      </form>
    </div>
  );
}
