"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Vertalingen ──────────────────────────────────────────────────────────────
const T = {
  nl: {
    title: "Retourverzoek (RMA)",
    subtitle: "Vul het formulier in om een retour of klacht te melden. We nemen zo snel mogelijk contact met je op.",
    sectionContact: "Contactgegevens",
    name: "Naam",
    company: "Bedrijfsnaam",
    email: "E-mailadres",
    phone: "Telefoonnummer",
    sectionProduct: "Productinformatie",
    product: "Productnaam / omschrijving",
    productHint: "Beschrijf het product zo duidelijk mogelijk.",
    productPlaceholder: "bijv. Gobohouder model XYZ",
    orderRef: "Ordernummer / factuurnummer",
    orderRefHint: "bijv. F-2024-042 of uw eigen referentie",
    orderRefPlaceholder: "F-2024-042",
    serial: "Serienummer",
    serialPlaceholder: "SN-XXXXXX",
    purchaseDate: "Aankoopdatum",
    qty: "Aantal",
    sectionReason: "Reden van retour",
    reason: "Reden",
    reasonPlaceholder: "Selecteer een reden…",
    description: "Toelichting",
    descriptionHint: "Beschrijf het probleem zo uitgebreid mogelijk.",
    descriptionPlaceholder: "Geef een duidelijke beschrijving van het probleem…",
    submit: "Retourverzoek indienen",
    submitting: "Bezig met versturen…",
    errorGeneric: "Er is iets misgegaan. Probeer het opnieuw.",
    errorConnection: "Verbindingsfout. Probeer het opnieuw.",
    required: "Verplichte velden zijn gemarkeerd met",
    reasons: {
      DEFECTIVE: "Defect product",
      WRONG_PRODUCT: "Verkeerd product geleverd",
      DAMAGED: "Beschadigd bij levering",
      NOT_AS_DESCRIBED: "Niet zoals beschreven",
      CHANGED_MIND: "Van gedachten veranderd",
      OTHER: "Anders",
    },
  },
  en: {
    title: "Return Request (RMA)",
    subtitle: "Fill in the form to report a return or complaint. We will contact you as soon as possible.",
    sectionContact: "Contact Details",
    name: "Name",
    company: "Company Name",
    email: "Email Address",
    phone: "Phone Number",
    sectionProduct: "Product Information",
    product: "Product name / description",
    productHint: "Describe the product as clearly as possible.",
    productPlaceholder: "e.g. Gobo holder model XYZ",
    orderRef: "Order number / invoice number",
    orderRefHint: "e.g. F-2024-042 or your own reference",
    orderRefPlaceholder: "F-2024-042",
    serial: "Serial Number",
    serialPlaceholder: "SN-XXXXXX",
    purchaseDate: "Purchase Date",
    qty: "Quantity",
    sectionReason: "Return Reason",
    reason: "Reason",
    reasonPlaceholder: "Select a reason…",
    description: "Description",
    descriptionHint: "Describe the problem as thoroughly as possible.",
    descriptionPlaceholder: "Please provide a clear description of the problem…",
    submit: "Submit Return Request",
    submitting: "Submitting…",
    errorGeneric: "Something went wrong. Please try again.",
    errorConnection: "Connection error. Please try again.",
    required: "Required fields are marked with",
    reasons: {
      DEFECTIVE: "Defective product",
      WRONG_PRODUCT: "Wrong product delivered",
      DAMAGED: "Damaged during delivery",
      NOT_AS_DESCRIBED: "Not as described",
      CHANGED_MIND: "Changed my mind",
      OTHER: "Other",
    },
  },
} as const;

type Lang = keyof typeof T;

// ─── Subcomponents ────────────────────────────────────────────────────────────
const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function RmaFormPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("nl");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tx = T[lang];

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
        body: JSON.stringify({ ...form, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || tx.errorGeneric);
        return;
      }
      router.push(`/retour/bedankt?nr=${data.rmaNumber}&lang=${lang}`);
    } catch {
      setError(tx.errorConnection);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Taal toggle */}
      <div className="flex justify-end mb-6">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
          <button
            onClick={() => setLang("nl")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              lang === "nl" ? "bg-brand-blue text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            🇳🇱 NL
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-slate-200 ${
              lang === "en" ? "bg-brand-blue text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            🇬🇧 EN
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{tx.title}</h1>
        <p className="text-slate-500 mt-1.5 text-sm leading-relaxed">{tx.subtitle}</p>
        <p className="text-xs text-slate-400 mt-3">
          {tx.required} <span className="text-red-500">*</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Contactgegevens */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {tx.sectionContact}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={tx.name} required>
              <input
                className={inputClass}
                value={form.submittedName}
                onChange={(e) => set("submittedName", e.target.value)}
                placeholder={lang === "nl" ? "Jan de Vries" : "John Smith"}
                required
              />
            </Field>
            <Field label={tx.company}>
              <input
                className={inputClass}
                value={form.submittedCompany}
                onChange={(e) => set("submittedCompany", e.target.value)}
                placeholder={lang === "nl" ? "Bedrijf BV" : "Company Ltd"}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={tx.email} required>
              <input
                type="email"
                className={inputClass}
                value={form.submittedEmail}
                onChange={(e) => set("submittedEmail", e.target.value)}
                placeholder={lang === "nl" ? "jan@bedrijf.nl" : "john@company.com"}
                required
              />
            </Field>
            <Field label={tx.phone}>
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
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {tx.sectionProduct}
          </h2>
          <Field label={tx.product} required hint={tx.productHint}>
            <input
              className={inputClass}
              value={form.productDescription}
              onChange={(e) => set("productDescription", e.target.value)}
              placeholder={tx.productPlaceholder}
              required
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={tx.orderRef} hint={tx.orderRefHint}>
              <input
                className={inputClass}
                value={form.orderReference}
                onChange={(e) => set("orderReference", e.target.value)}
                placeholder={tx.orderRefPlaceholder}
              />
            </Field>
            <Field label={tx.serial}>
              <input
                className={inputClass}
                value={form.serialNumber}
                onChange={(e) => set("serialNumber", e.target.value)}
                placeholder={tx.serialPlaceholder}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={tx.purchaseDate}>
              <input
                type="date"
                className={inputClass}
                value={form.purchaseDate}
                onChange={(e) => set("purchaseDate", e.target.value)}
              />
            </Field>
            <Field label={tx.qty} required>
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

        {/* Reden */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {tx.sectionReason}
          </h2>
          <Field label={tx.reason} required>
            <select
              className={inputClass}
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              required
            >
              <option value="">{tx.reasonPlaceholder}</option>
              {Object.entries(tx.reasons).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label={tx.description} required hint={tx.descriptionHint}>
            <textarea
              className={`${inputClass} resize-none`}
              rows={5}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={tx.descriptionPlaceholder}
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
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-lg text-sm transition-colors shadow-sm"
        >
          {loading ? tx.submitting : tx.submit}
        </button>
      </form>
    </div>
  );
}
