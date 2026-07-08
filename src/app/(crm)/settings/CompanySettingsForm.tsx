"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

interface Settings {
  companyName?: string | null;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  kvkNumber?: string | null;
  vatNumber?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  ibanAccountHolder?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  contactPersonName?: string | null;
  contactPersonPhone?: string | null;
  contactPersonEmail?: string | null;
  termsNl?: string | null;
  termsEn?: string | null;
  quoteTerms?: string | null;
  invoiceFooter?: string | null;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white placeholder-slate-400";
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

export function CompanySettingsForm({ initialSettings }: { initialSettings: Settings | null }) {
  const s = initialSettings ?? {};

  const [form, setForm] = useState<Settings>({
    companyName: s.companyName ?? "",
    logoUrl: (s as Settings).logoUrl ?? "",
    addressLine1: s.addressLine1 ?? "",
    addressLine2: s.addressLine2 ?? "",
    city: s.city ?? "",
    postalCode: s.postalCode ?? "",
    country: s.country ?? "Nederland",
    kvkNumber: s.kvkNumber ?? "",
    vatNumber: s.vatNumber ?? "",
    iban: s.iban ?? "",
    bic: s.bic ?? "",
    bankName: (s as Settings).bankName ?? "",
    ibanAccountHolder: (s as Settings).ibanAccountHolder ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    website: s.website ?? "",
    contactPersonName: (s as Settings).contactPersonName ?? "",
    contactPersonPhone: (s as Settings).contactPersonPhone ?? "",
    contactPersonEmail: (s as Settings).contactPersonEmail ?? "",
    termsNl: (s as Settings).termsNl ?? "",
    termsEn: (s as Settings).termsEn ?? "",
    quoteTerms: s.quoteTerms ?? "",
    invoiceFooter: s.invoiceFooter ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handle(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const section = (title: string) => (
    <div className="mb-1 mt-6">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{title}</p>
      <div className="border-t border-slate-200 mt-1.5" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        {section("Bedrijfsgegevens")}
        <Field label="Bedrijfsnaam" name="companyName" value={form.companyName ?? ""} onChange={handle} placeholder="Distrixs BV" />
        <Field label="Logo URL" name="logoUrl" value={form.logoUrl ?? ""} onChange={handle} placeholder="https://distrixs.nl/logo.png" />

        <div className="grid grid-cols-2 gap-4">
          <Field label="KVK-nummer" name="kvkNumber" value={form.kvkNumber ?? ""} onChange={handle} placeholder="12345678" />
          <Field label="BTW-nummer" name="vatNumber" value={form.vatNumber ?? ""} onChange={handle} placeholder="NL123456789B01" />
        </div>

        {section("Adres")}
        <Field label="Adresregel 1" name="addressLine1" value={form.addressLine1 ?? ""} onChange={handle} placeholder="Straatnaam 1" />
        <Field label="Adresregel 2" name="addressLine2" value={form.addressLine2 ?? ""} onChange={handle} placeholder="(optioneel)" />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Postcode" name="postalCode" value={form.postalCode ?? ""} onChange={handle} placeholder="1234 AB" />
          <div className="col-span-2">
            <Field label="Stad" name="city" value={form.city ?? ""} onChange={handle} placeholder="Amsterdam" />
          </div>
        </div>
        <Field label="Land" name="country" value={form.country ?? ""} onChange={handle} placeholder="Nederland" />

        {section("Contactgegevens")}
        <div className="grid grid-cols-2 gap-4">
          <Field label="E-mail" name="email" value={form.email ?? ""} onChange={handle} type="email" placeholder="info@distrixs.nl" />
          <Field label="Telefoon" name="phone" value={form.phone ?? ""} onChange={handle} placeholder="+31 20 123 4567" />
        </div>
        <Field label="Website" name="website" value={form.website ?? ""} onChange={handle} placeholder="https://distrixs.nl" />

        {section("Bankgegevens")}
        <Field label="Bank" name="bankName" value={form.bankName ?? ""} onChange={handle} placeholder="ING" />
        <Field label="Tenaamstelling (t.n.v.)" name="ibanAccountHolder" value={form.ibanAccountHolder ?? ""} onChange={handle} placeholder="Distrixs B.V." />
        <div className="grid grid-cols-2 gap-4">
          <Field label="IBAN" name="iban" value={form.iban ?? ""} onChange={handle} placeholder="NL14 INGB 0007 1132 63" />
          <Field label="BIC / SWIFT" name="bic" value={form.bic ?? ""} onChange={handle} placeholder="INGBNL2A" />
        </div>

        {section("Contactpersoon op offerte")}
        <div className="grid grid-cols-3 gap-4">
          <Field label="Naam" name="contactPersonName" value={form.contactPersonName ?? ""} onChange={handle} placeholder="Rolf Schild" />
          <Field label="Telefoon" name="contactPersonPhone" value={form.contactPersonPhone ?? ""} onChange={handle} placeholder="+31 6 41430736" />
          <Field label="E-mail" name="contactPersonEmail" value={form.contactPersonEmail ?? ""} onChange={handle} placeholder="rolf@distrixs.nl" />
        </div>

        {section("Algemene voorwaarden")}
        <div>
          <label className={labelClass}>Algemene voorwaarden NL (volledige tekst voor PDF)</label>
          <textarea
            value={form.termsNl ?? ""}
            onChange={(e) => handle("termsNl", e.target.value)}
            rows={8}
            placeholder="1 Definities&#10;Klant: bedrijven in bezit van een kvk...&#10;&#10;2 Toepasselijkheid&#10;..."
            className={`${inputClass} resize-y font-mono text-xs`}
          />
        </div>
        <div>
          <label className={labelClass}>General Terms &amp; Conditions EN (full text for PDF)</label>
          <textarea
            value={form.termsEn ?? ""}
            onChange={(e) => handle("termsEn", e.target.value)}
            rows={8}
            placeholder="1 Definitions&#10;Customer: companies in possession of a chamber of commerce...&#10;&#10;2 Applicability&#10;..."
            className={`${inputClass} resize-y font-mono text-xs`}
          />
        </div>

        {section("Document teksten")}
        <div>
          <label className={labelClass}>Offerte voorwaarden</label>
          <textarea
            value={form.quoteTerms ?? ""}
            onChange={(e) => handle("quoteTerms", e.target.value)}
            rows={3}
            placeholder="Bijv. Geldig voor 30 dagen. Prijzen zijn excl. BTW tenzij anders vermeld."
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label className={labelClass}>Factuur voettekst</label>
          <textarea
            value={form.invoiceFooter ?? ""}
            onChange={(e) => handle("invoiceFooter", e.target.value)}
            rows={3}
            placeholder="Bijv. Betaling binnen 30 dagen na factuurdatum. IBAN: NL91 ABNA ..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? "Opslaan…" : "Wijzigingen opslaan"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <Check className="w-4 h-4" />
            Opgeslagen
          </span>
        )}
      </div>
    </div>
  );
}
