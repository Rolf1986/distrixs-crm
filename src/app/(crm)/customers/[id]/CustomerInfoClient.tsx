"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Plus, Trash2, Search, Loader2 } from "lucide-react";

type CustomerInfo = {
  id: string;
  companyName: string;
  kvkNumber: string | null;
  vatNumber: string | null;
  email: string | null;
  status: string;
  defaultPaymentTerm: string;
  defaultLanguage: string;
  notes: string | null;
  addresses: Array<{
    id: string;
    type: string;
    isDefault: boolean;
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    country: string;
  }>;
};

const ADDRESS_TYPE_LABEL: Record<string, string> = {
  BILLING: "Factuur",
  SHIPPING: "Levering",
  VISITING: "Bezoek",
};

const ADDRESS_TYPE_COLOR: Record<string, string> = {
  BILLING: "bg-brand-blue-light text-brand-blue",
  SHIPPING: "bg-green-100 text-green-700",
  VISITING: "bg-slate-100 text-slate-600",
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Actief" },
  { value: "INACTIVE", label: "Inactief" },
  { value: "PROSPECT", label: "Prospect" },
];

const PAYMENT_TERM_OPTIONS = [
  { value: "DAYS_14", label: "14 dagen" },
  { value: "DAYS_30", label: "30 dagen" },
  { value: "PREPAYMENT", label: "Vooruitbetaling" },
  { value: "INSTALLMENTS", label: "Termijnen" },
];

const PAYMENT_TERM_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_TERM_OPTIONS.map((o) => [o.value, o.label])
);

const LANGUAGE_LABEL: Record<string, string> = { NL: "🇳🇱 Nederlands", EN: "🇬🇧 Engels" };

const inputClass =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white w-full";

function InlineField({
  label,
  value,
  displayValue,
  editContent,
  onSave,
  onCancel,
  editing,
  onEdit,
}: {
  label: string;
  value: string;
  displayValue?: React.ReactNode;
  editContent: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0 group">
      <dt className="text-sm text-slate-500 shrink-0 w-40 pt-0.5">{label}</dt>
      {editing ? (
        <dd className="flex-1 flex items-center gap-2">
          {editContent}
          <button onClick={onSave} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 shrink-0">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={onCancel} className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </dd>
      ) : (
        <dd
          className="flex-1 flex items-center justify-between gap-2 cursor-pointer"
          onClick={onEdit}
          title="Klik om te bewerken"
        >
          <span className="text-sm text-slate-900">
            {displayValue ?? (value || <span className="text-slate-300">—</span>)}
          </span>
          <Pencil className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 shrink-0" />
        </dd>
      )}
    </div>
  );
}

const ADDRESS_TYPES = [
  { value: "BILLING", label: "Factuuradres" },
  { value: "SHIPPING", label: "Leveringsadres" },
  { value: "VISITING", label: "Bezoekadres" },
];

const blankAddress = { type: "BILLING", street: "", houseNumber: "", postalCode: "", city: "", country: "NL", isDefault: false };

/**
 * Parseert een VIES-adresblok naar losse velden.
 * VIES geeft bijv: "HOOFDSTRAAT 12\n1234 AB AMSTERDAM"
 * of "STREET 1 BOX 2, 1000 BRUSSELS"
 */
function parseViesAddress(raw: string, countryCode = "NL"): { street: string; houseNumber: string; postalCode: string; city: string; country: string } | null {
  if (!raw || raw === "---") return null;
  // Normaliseer: vervang komma's door newlines, trim witruimte
  const lines = raw.replace(/,/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 1) return null;

  // Probeer postcode + stad uit de laatste regel te halen
  // NL: "1234 AB AMSTERDAM"  BE: "1000 BRUSSEL"  DE: "10115 BERLIN"
  const lastLine = lines[lines.length - 1];
  const postcodeCity = lastLine.match(/^([A-Z0-9]{4,7})\s+(.+)$/i);

  let postalCode = "";
  let city = "";
  if (postcodeCity) {
    postalCode = postcodeCity[1].toUpperCase();
    city = postcodeCity[2];
  } else {
    city = lastLine;
  }

  // Straat + huisnummer uit de eerste regel
  const streetLine = lines[0];
  const streetMatch = streetLine.match(/^(.+?)\s+(\d+\s*[A-Z]?\d*)$/i);
  let street = streetLine;
  let houseNumber = "";
  if (streetMatch) {
    street = streetMatch[1].trim();
    houseNumber = streetMatch[2].trim();
  }

  return { street, houseNumber, postalCode, city, country: countryCode };
}

export function CustomerInfoClient({ customer: initial }: { customer: CustomerInfo }) {
  const router = useRouter();
  const [customer, setCustomer] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notesText, setNotesText] = useState(initial.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [kvkLookupLoading, setKvkLookupLoading] = useState(false);
  const [kvkError, setKvkError] = useState<string | null>(null);
  const [viesLoading, setViesLoading] = useState(false);
  const [viesResult, setViesResult] = useState<{
    valid?: boolean;
    companyName?: string;
    parsedAddress?: { street: string; houseNumber: string; postalCode: string; city: string; country: string } | null;
    rawAddress?: string;
  } | null>(null);
  const [viesAddressSaving, setViesAddressSaving] = useState(false);
  const [viesAddressSaved, setViesAddressSaved] = useState(false);
  const [viesNameSaved, setViesNameSaved] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addressForm, setAddressForm] = useState(blankAddress);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddressForm, setEditAddressForm] = useState<typeof blankAddress>(blankAddress);
  const [addressSaving, setAddressSaving] = useState(false);

  async function validateVat() {
    const vat = fieldValues["vatNumber"] ?? customer.vatNumber ?? "";
    if (!vat.trim()) { setViesResult({ valid: false }); return; }
    setViesLoading(true);
    setViesResult(null);
    setViesAddressSaved(false);
    setViesNameSaved(false);
    try {
      const res = await fetch(`/api/kvk-lookup?vat=${encodeURIComponent(vat.trim())}`);
      if (!res.ok) { setViesResult({ valid: false }); return; }
      const data = await res.json() as { vatValid?: boolean; companyName?: string; viesAddress?: string; vatNumber?: string };
      // Landcode afleiden uit BTW-nummer (eerste 2 letters)
      const countryCode = (data.vatNumber ?? vat).replace(/[^A-Z]/g, "").slice(0, 2) || "NL";
      const parsed = data.viesAddress ? parseViesAddress(data.viesAddress, countryCode) : null;
      setViesResult({ valid: data.vatValid, companyName: data.companyName, parsedAddress: parsed, rawAddress: data.viesAddress });
    } finally {
      setViesLoading(false);
    }
  }

  async function adoptViesName() {
    const name = viesResult?.companyName;
    if (!name) return;
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: name }),
    });
    if (res.ok) {
      setCustomer((c) => ({ ...c, companyName: name }));
      setViesNameSaved(true);
      router.refresh();
    }
  }

  async function adoptViesAddress() {
    if (!viesResult?.parsedAddress) return;
    setViesAddressSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "BILLING",
          isDefault: true,
          ...viesResult.parsedAddress,
        }),
      });
      if (res.ok) {
        const addr = await res.json();
        setCustomer((c) => ({ ...c, addresses: [...c.addresses.filter(a => !(a.type === "BILLING" && a.isDefault)), addr] }));
        setViesAddressSaved(true);
        router.refresh();
      }
    } finally {
      setViesAddressSaving(false);
    }
  }

  async function lookupKvK() {
    const kvk = fieldValues["kvkNumber"] ?? customer.kvkNumber ?? "";
    if (!kvk.trim()) {
      setKvkError("Vul eerst een KvK-nummer in");
      return;
    }
    setKvkLookupLoading(true);
    setKvkError(null);
    try {
      const res = await fetch(`/api/kvk-lookup?kvk=${encodeURIComponent(kvk.trim())}`);
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setKvkError(d.error ?? "Niet gevonden");
        return;
      }
      const data = await res.json() as { companyName?: string; vatNumber?: string };
      const updates: Record<string, string | null> = {};
      if (data.companyName) updates.companyName = data.companyName;
      if (data.vatNumber) updates.vatNumber = data.vatNumber;

      // Sla de gevonden velden op
      const patchRes = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (patchRes.ok) {
        setCustomer((c) => ({ ...c, ...updates }));
        router.refresh();
      }
    } finally {
      setKvkLookupLoading(false);
    }
  }

  function startEdit(field: string, currentValue: string) {
    setEditing(field);
    setFieldValues((prev) => ({ ...prev, [field]: currentValue }));
  }

  async function saveField(field: string) {
    const value = fieldValues[field] ?? "";
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    if (res.ok) {
      setCustomer((c) => ({ ...c, [field]: value || null }));
      setEditing(null);
      router.refresh();
    }
  }

  async function addAddress() {
    setAddressSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressForm),
      });
      if (res.ok) {
        const addr = await res.json();
        setCustomer((c) => ({ ...c, addresses: [...c.addresses, addr] }));
        setAddressForm(blankAddress);
        setShowAddAddress(false);
        router.refresh();
      }
    } finally {
      setAddressSaving(false);
    }
  }

  async function saveAddress(addressId: string) {
    setAddressSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/addresses/${addressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editAddressForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setCustomer((c) => ({
          ...c,
          addresses: c.addresses.map((a) => (a.id === addressId ? { ...a, ...updated } : a)),
        }));
        setEditingAddressId(null);
        router.refresh();
      }
    } finally {
      setAddressSaving(false);
    }
  }

  async function deleteAddress(addressId: string) {
    if (!confirm("Adres verwijderen?")) return;
    await fetch(`/api/customers/${customer.id}/addresses/${addressId}`, { method: "DELETE" });
    setCustomer((c) => ({ ...c, addresses: c.addresses.filter((a) => a.id !== addressId) }));
    router.refresh();
  }

  async function saveNotes() {
    await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesText }),
    });
    setCustomer((c) => ({ ...c, notes: notesText }));
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: Bedrijfsgegevens */}
      <div className="col-span-2 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Bedrijfsgegevens
          </h2>
          <dl>
            <InlineField
              label="Bedrijfsnaam"
              value={customer.companyName}
              editing={editing === "companyName"}
              onEdit={() => startEdit("companyName", customer.companyName)}
              onSave={() => saveField("companyName")}
              onCancel={() => setEditing(null)}
              editContent={
                <input
                  className={inputClass}
                  value={fieldValues.companyName ?? customer.companyName}
                  onChange={(e) => setFieldValues((f) => ({ ...f, companyName: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") saveField("companyName"); if (e.key === "Escape") setEditing(null); }}
                  autoFocus
                />
              }
            />
            {/* VIES naam suggestie — alleen tonen als naam afwijkt van huidig */}
            {viesResult?.valid && viesResult.companyName &&
              viesResult.companyName.toLowerCase() !== customer.companyName.toLowerCase() && (
              <div className="py-2 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 w-40 shrink-0">VIES naam</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-slate-700 font-medium">{viesResult.companyName}</span>
                    {viesNameSaved ? (
                      <span className="text-xs text-green-600 font-medium">✓ Overgenomen</span>
                    ) : (
                      <button
                        onClick={adoptViesName}
                        className="text-xs text-brand-blue hover:text-brand-blue-dark font-medium border border-brand-blue/20 bg-brand-blue-light px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Overnemen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <InlineField
              label="E-mail (factuur)"
              value={customer.email ?? ""}
              editing={editing === "email"}
              onEdit={() => startEdit("email", customer.email ?? "")}
              onSave={() => saveField("email")}
              onCancel={() => setEditing(null)}
              editContent={
                <input
                  className={inputClass}
                  type="email"
                  placeholder="administratie@bedrijf.nl"
                  value={fieldValues.email ?? customer.email ?? ""}
                  onChange={(e) => setFieldValues((f) => ({ ...f, email: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") saveField("email"); if (e.key === "Escape") setEditing(null); }}
                  autoFocus
                />
              }
            />
            <InlineField
              label="KvK-nummer"
              value={customer.kvkNumber ?? ""}
              editing={editing === "kvkNumber"}
              onEdit={() => startEdit("kvkNumber", customer.kvkNumber ?? "")}
              onSave={() => saveField("kvkNumber")}
              onCancel={() => setEditing(null)}
              editContent={
                <input
                  className={inputClass}
                  placeholder="12345678"
                  value={fieldValues.kvkNumber ?? customer.kvkNumber ?? ""}
                  onChange={(e) => setFieldValues((f) => ({ ...f, kvkNumber: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") saveField("kvkNumber"); if (e.key === "Escape") setEditing(null); }}
                  autoFocus
                />
              }
            />
            <InlineField
              label="BTW-nummer"
              value={customer.vatNumber ?? ""}
              displayValue={
                <span className="flex items-center gap-2">
                  <span>{customer.vatNumber || <span className="text-slate-300">—</span>}</span>
                  {customer.vatNumber && viesResult && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${viesResult.valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {viesResult.valid ? "✓ VIES geldig" : "✗ Niet geldig"}
                    </span>
                  )}
                  {customer.vatNumber && (
                    <button
                      onClick={(e) => { e.stopPropagation(); validateVat(); }}
                      disabled={viesLoading}
                      className="text-xs text-slate-400 hover:text-brand-blue transition-colors disabled:opacity-50 ml-1"
                      title="Valideer via EU VIES"
                    >
                      {viesLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "VIES ↗"}
                    </button>
                  )}
                </span>
              }
              editing={editing === "vatNumber"}
              onEdit={() => startEdit("vatNumber", customer.vatNumber ?? "")}
              onSave={() => saveField("vatNumber")}
              onCancel={() => setEditing(null)}
              editContent={
                <input
                  className={inputClass}
                  placeholder="NL123456789B01"
                  value={fieldValues.vatNumber ?? customer.vatNumber ?? ""}
                  onChange={(e) => setFieldValues((f) => ({ ...f, vatNumber: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") saveField("vatNumber"); if (e.key === "Escape") setEditing(null); }}
                  autoFocus
                />
              }
            />
            {/* VIES adres overnemen */}
            {viesResult?.valid && viesResult.parsedAddress && (
              <div className="py-2.5 border-b border-slate-50">
                <div className="flex items-start gap-3">
                  <span className="text-sm text-slate-400 w-40 shrink-0 pt-0.5">VIES adres</span>
                  <div className="flex-1">
                    <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mb-2 font-mono leading-relaxed">
                      {viesResult.parsedAddress.street} {viesResult.parsedAddress.houseNumber}<br />
                      {viesResult.parsedAddress.postalCode} {viesResult.parsedAddress.city}<br />
                      {viesResult.parsedAddress.country}
                    </div>
                    {viesAddressSaved ? (
                      <span className="text-xs text-green-600 font-medium">✓ Factuuradres opgeslagen</span>
                    ) : (
                      <button
                        onClick={adoptViesAddress}
                        disabled={viesAddressSaving}
                        className="flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:text-brand-blue-dark border border-brand-blue/20 bg-brand-blue-light px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {viesAddressSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Als factuuradres overnemen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* KvK opzoeken knop */}
            <div className="py-2.5 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400 w-40 shrink-0">KvK opzoeken</span>
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={lookupKvK}
                    disabled={kvkLookupLoading}
                    className="flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:text-brand-blue-dark border border-brand-blue/20 hover:border-blue-400 bg-brand-blue-light hover:bg-brand-blue-light px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {kvkLookupLoading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Search className="w-3.5 h-3.5" />}
                    {kvkLookupLoading ? "Bezig…" : "Naam & BTW ophalen"}
                  </button>
                  {kvkError && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {kvkError}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-300 mt-1 ml-[11.5rem]">Vult bedrijfsnaam en BTW-nummer automatisch in via KvK</p>
            </div>
            <InlineField
              label="Status"
              value={customer.status}
              displayValue={
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  customer.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                  customer.status === "PROSPECT" ? "bg-brand-blue-light text-brand-blue" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {STATUS_OPTIONS.find((o) => o.value === customer.status)?.label ?? customer.status}
                </span>
              }
              editing={editing === "status"}
              onEdit={() => startEdit("status", customer.status)}
              onSave={() => saveField("status")}
              onCancel={() => setEditing(null)}
              editContent={
                <select
                  className={inputClass}
                  value={fieldValues.status ?? customer.status}
                  onChange={(e) => setFieldValues((f) => ({ ...f, status: e.target.value }))}
                  autoFocus
                >
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              }
            />
            <InlineField
              label="Betaaltermijn"
              value={customer.defaultPaymentTerm}
              displayValue={PAYMENT_TERM_LABEL[customer.defaultPaymentTerm] ?? customer.defaultPaymentTerm}
              editing={editing === "defaultPaymentTerm"}
              onEdit={() => startEdit("defaultPaymentTerm", customer.defaultPaymentTerm)}
              onSave={() => saveField("defaultPaymentTerm")}
              onCancel={() => setEditing(null)}
              editContent={
                <select
                  className={inputClass}
                  value={fieldValues.defaultPaymentTerm ?? customer.defaultPaymentTerm}
                  onChange={(e) => setFieldValues((f) => ({ ...f, defaultPaymentTerm: e.target.value }))}
                  autoFocus
                >
                  {PAYMENT_TERM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              }
            />
            <InlineField
              label="Taal (offerte/factuur)"
              value={customer.defaultLanguage}
              displayValue={LANGUAGE_LABEL[customer.defaultLanguage] ?? customer.defaultLanguage}
              editing={editing === "defaultLanguage"}
              onEdit={() => startEdit("defaultLanguage", customer.defaultLanguage)}
              onSave={() => saveField("defaultLanguage")}
              onCancel={() => setEditing(null)}
              editContent={
                <select
                  className={inputClass}
                  value={fieldValues.defaultLanguage ?? customer.defaultLanguage}
                  onChange={(e) => setFieldValues((f) => ({ ...f, defaultLanguage: e.target.value }))}
                  autoFocus
                >
                  <option value="NL">🇳🇱 Nederlands</option>
                  <option value="EN">🇬🇧 Engels</option>
                </select>
              }
            />
          </dl>
        </div>

        {/* Adressen */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Adressen
            </h2>
            <button
              onClick={() => setShowAddAddress(!showAddAddress)}
              className="flex items-center gap-1 text-xs text-brand-blue hover:text-brand-blue-dark font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Adres toevoegen
            </button>
          </div>

          {/* Add form */}
          {showAddAddress && (
            <div className="mb-4 p-4 border border-blue-100 bg-brand-blue-light/30 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type</label>
                  <select className={inputClass} value={addressForm.type} onChange={(e) => setAddressForm((f) => ({ ...f, type: e.target.value }))}>
                    {ADDRESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Land</label>
                  <input className={inputClass} value={addressForm.country} onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))} placeholder="NL" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Straat</label>
                  <input className={inputClass} value={addressForm.street} onChange={(e) => setAddressForm((f) => ({ ...f, street: e.target.value }))} placeholder="Hoofdstraat" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Huisnummer</label>
                  <input className={inputClass} value={addressForm.houseNumber} onChange={(e) => setAddressForm((f) => ({ ...f, houseNumber: e.target.value }))} placeholder="1A" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Postcode</label>
                  <input className={inputClass} value={addressForm.postalCode} onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))} placeholder="1234 AB" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Stad</label>
                  <input className={inputClass} value={addressForm.city} onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))} placeholder="Amsterdam" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm((f) => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
                Standaard voor dit adrestype
              </label>
              <div className="flex gap-2">
                <button
                  onClick={addAddress}
                  disabled={addressSaving || !addressForm.street.trim() || !addressForm.city.trim()}
                  className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                >
                  <Check className="w-3.5 h-3.5" />
                  Opslaan
                </button>
                <button onClick={() => setShowAddAddress(false)} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5">
                  Annuleren
                </button>
              </div>
            </div>
          )}

          {customer.addresses.length === 0 && !showAddAddress && (
            <p className="text-sm text-slate-400">Geen adressen bekend</p>
          )}

          <div className="space-y-3">
            {customer.addresses.map((addr) =>
              editingAddressId === addr.id ? (
                <div key={addr.id} className="p-4 border border-blue-100 bg-brand-blue-light/30 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Type</label>
                      <select className={inputClass} value={editAddressForm.type} onChange={(e) => setEditAddressForm((f) => ({ ...f, type: e.target.value }))}>
                        {ADDRESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Land</label>
                      <input className={inputClass} value={editAddressForm.country} onChange={(e) => setEditAddressForm((f) => ({ ...f, country: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Straat</label>
                      <input className={inputClass} value={editAddressForm.street} onChange={(e) => setEditAddressForm((f) => ({ ...f, street: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Huisnummer</label>
                      <input className={inputClass} value={editAddressForm.houseNumber} onChange={(e) => setEditAddressForm((f) => ({ ...f, houseNumber: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Postcode</label>
                      <input className={inputClass} value={editAddressForm.postalCode} onChange={(e) => setEditAddressForm((f) => ({ ...f, postalCode: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Stad</label>
                      <input className={inputClass} value={editAddressForm.city} onChange={(e) => setEditAddressForm((f) => ({ ...f, city: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveAddress(addr.id)} disabled={addressSaving} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
                      <Check className="w-3.5 h-3.5" />
                      Opslaan
                    </button>
                    <button onClick={() => setEditingAddressId(null)} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5">
                      Annuleren
                    </button>
                  </div>
                </div>
              ) : (
                <div key={addr.id} className="border border-slate-100 rounded-lg p-4 group hover:border-slate-200 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ADDRESS_TYPE_COLOR[addr.type] ?? "bg-slate-100 text-slate-600"}`}>
                          {ADDRESS_TYPE_LABEL[addr.type] ?? addr.type}
                        </span>
                        {addr.isDefault && <span className="text-xs text-slate-400">Standaard</span>}
                      </div>
                      <p className="text-sm text-slate-900">{addr.street} {addr.houseNumber}</p>
                      <p className="text-sm text-slate-600">{addr.postalCode} {addr.city}</p>
                      <p className="text-sm text-slate-500">{addr.country}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingAddressId(addr.id);
                          setEditAddressForm({ type: addr.type, street: addr.street, houseNumber: addr.houseNumber, postalCode: addr.postalCode, city: addr.city, country: addr.country, isDefault: addr.isDefault });
                        }}
                        className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteAddress(addr.id)} className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Right: Notes */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Opmerkingen
            </h2>
            {notesSaved && <span className="text-xs text-green-600 font-medium">✓ Opgeslagen</span>}
          </div>
          <textarea
            className="w-full text-sm text-slate-700 bg-slate-50 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none border border-slate-100"
            rows={8}
            placeholder="Interne notities over deze klant…"
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            onBlur={saveNotes}
          />
          <p className="text-xs text-slate-400 mt-1">Automatisch opgeslagen bij verlaten veld</p>
        </div>
      </div>
    </div>
  );
}
