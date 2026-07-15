"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Star, MapPin, User } from "lucide-react";

type Address = {
  id: string;
  type: string;
  isDefault: boolean;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  roleOrFunction: string | null;
  isPrimary: boolean;
};

const inputClass =
  "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white w-full";

const ADDRESS_TYPE_LABEL: Record<string, string> = {
  VISITING: "Bezoekadres",
  BILLING: "Factuuradres",
  SHIPPING: "Verzendadres",
};

export function SupplierContactsAddresses({
  supplierId,
  addresses,
  contacts,
}: {
  supplierId: string;
  addresses: Address[];
  contacts: Contact[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Address form
  const blankAddr = { type: "VISITING", street: "", houseNumber: "", postalCode: "", city: "", country: "NL", isDefault: false };
  const [addrForm, setAddrForm] = useState(blankAddr);
  const [showAddr, setShowAddr] = useState(false);

  // Contact form
  const blankContact = { firstName: "", lastName: "", email: "", phone: "", roleOrFunction: "", isPrimary: false };
  const [contactForm, setContactForm] = useState(blankContact);
  const [showContact, setShowContact] = useState(false);

  async function addAddress() {
    if (!addrForm.street.trim() || !addrForm.city.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addrForm),
      });
      if (!res.ok) { alert("Adres toevoegen mislukt"); return; }
      setAddrForm(blankAddr);
      setShowAddr(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function deleteAddress(id: string) {
    if (!confirm("Dit adres verwijderen?")) return;
    await fetch(`/api/suppliers/${supplierId}/addresses/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function setDefaultAddress(a: Address) {
    await fetch(`/api/suppliers/${supplierId}/addresses/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true, type: a.type }),
    });
    router.refresh();
  }

  async function addContact() {
    if (!contactForm.firstName.trim() && !contactForm.lastName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (!res.ok) { alert("Contactpersoon toevoegen mislukt"); return; }
      setContactForm(blankContact);
      setShowContact(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function deleteContact(id: string) {
    if (!confirm("Deze contactpersoon verwijderen?")) return;
    await fetch(`/api/suppliers/${supplierId}/contacts/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function setPrimaryContact(id: string) {
    await fetch(`/api/suppliers/${supplierId}/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    router.refresh();
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Contactpersonen */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <User className="w-3.5 h-3.5" /> Contactpersonen
          </h2>
          <button onClick={() => setShowContact(!showContact)} className="flex items-center gap-1 text-xs text-brand-blue hover:underline">
            <Plus className="w-3.5 h-3.5" /> Toevoegen
          </button>
        </div>

        {showContact && (
          <div className="bg-white rounded-xl border border-brand-blue/20 p-4 mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className={inputClass} placeholder="Voornaam" value={contactForm.firstName} onChange={(e) => setContactForm((p) => ({ ...p, firstName: e.target.value }))} />
              <input className={inputClass} placeholder="Achternaam" value={contactForm.lastName} onChange={(e) => setContactForm((p) => ({ ...p, lastName: e.target.value }))} />
              <input className={inputClass} type="email" placeholder="E-mail" value={contactForm.email} onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))} />
              <input className={inputClass} placeholder="Telefoon" value={contactForm.phone} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))} />
              <input className={`${inputClass} col-span-2`} placeholder="Functie (bijv. Inkoop, Sales)" value={contactForm.roleOrFunction} onChange={(e) => setContactForm((p) => ({ ...p, roleOrFunction: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={contactForm.isPrimary} onChange={(e) => setContactForm((p) => ({ ...p, isPrimary: e.target.checked }))} />
              Hoofdcontactpersoon
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowContact(false)} className="px-3 py-1.5 text-sm text-slate-500">Annuleren</button>
              <button onClick={addContact} disabled={saving} className="flex items-center gap-1.5 bg-brand-blue text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-60">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Opslaan
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {contacts.length === 0 && <p className="text-sm text-slate-400">Nog geen contactpersonen.</p>}
          {contacts.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 text-sm">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</span>
                  {c.isPrimary && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">HOOFD</span>}
                </div>
                {c.roleOrFunction && <p className="text-xs text-slate-400">{c.roleOrFunction}</p>}
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  {c.email && <p>{c.email}</p>}
                  {c.phone && <p>{c.phone}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!c.isPrimary && (
                  <button onClick={() => setPrimaryContact(c.id)} className="p-1.5 text-slate-300 hover:text-amber-500" title="Als hoofdcontact instellen">
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => deleteContact(c.id)} className="p-1.5 text-slate-300 hover:text-red-500" title="Verwijderen">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Adressen */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" /> Adressen
          </h2>
          <button onClick={() => setShowAddr(!showAddr)} className="flex items-center gap-1 text-xs text-brand-blue hover:underline">
            <Plus className="w-3.5 h-3.5" /> Toevoegen
          </button>
        </div>

        {showAddr && (
          <div className="bg-white rounded-xl border border-brand-blue/20 p-4 mb-3 space-y-3">
            <select className={inputClass} value={addrForm.type} onChange={(e) => setAddrForm((p) => ({ ...p, type: e.target.value }))}>
              <option value="VISITING">Bezoekadres</option>
              <option value="BILLING">Factuuradres</option>
              <option value="SHIPPING">Verzendadres</option>
            </select>
            <div className="grid grid-cols-3 gap-3">
              <input className={`${inputClass} col-span-2`} placeholder="Straat" value={addrForm.street} onChange={(e) => setAddrForm((p) => ({ ...p, street: e.target.value }))} />
              <input className={inputClass} placeholder="Nr." value={addrForm.houseNumber} onChange={(e) => setAddrForm((p) => ({ ...p, houseNumber: e.target.value }))} />
              <input className={inputClass} placeholder="Postcode" value={addrForm.postalCode} onChange={(e) => setAddrForm((p) => ({ ...p, postalCode: e.target.value }))} />
              <input className={`${inputClass} col-span-2`} placeholder="Plaats" value={addrForm.city} onChange={(e) => setAddrForm((p) => ({ ...p, city: e.target.value }))} />
              <input className={`${inputClass} col-span-3`} placeholder="Land" value={addrForm.country} onChange={(e) => setAddrForm((p) => ({ ...p, country: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={addrForm.isDefault} onChange={(e) => setAddrForm((p) => ({ ...p, isDefault: e.target.checked }))} />
              Standaardadres voor dit type
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddr(false)} className="px-3 py-1.5 text-sm text-slate-500">Annuleren</button>
              <button onClick={addAddress} disabled={saving} className="flex items-center gap-1.5 bg-brand-blue text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-60">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Opslaan
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {addresses.length === 0 && <p className="text-sm text-slate-400">Nog geen adressen.</p>}
          {addresses.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{ADDRESS_TYPE_LABEL[a.type] ?? a.type}</span>
                  {a.isDefault && <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">STANDAARD</span>}
                </div>
                <p className="text-sm text-slate-700 mt-1">{[a.street, a.houseNumber].filter(Boolean).join(" ")}</p>
                <p className="text-xs text-slate-500">{[a.postalCode, a.city].filter(Boolean).join("  ")}{a.country && a.country !== "NL" ? `, ${a.country}` : ""}</p>
              </div>
              <div className="flex items-center gap-1">
                {!a.isDefault && (
                  <button onClick={() => setDefaultAddress(a)} className="p-1.5 text-slate-300 hover:text-green-600" title="Als standaard instellen">
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => deleteAddress(a.id)} className="p-1.5 text-slate-300 hover:text-red-500" title="Verwijderen">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
