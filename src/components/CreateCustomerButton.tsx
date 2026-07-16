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
  const [paymentTerm, setPaymentTerm] = useState("DAYS_14");
  const [language, setLanguage] = useState("NL");
  const [email, setEmail] = useState("");
  // Adres
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  // Contactpersoon
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");

  // Postcode + huisnummer → straat + plaats automatisch invullen (PDOK)
  async function lookupAddress(pc: string, nr: string) {
    const clean = pc.replace(/\s+/g, "").toUpperCase();
    if (!/^\d{4}[A-Z]{2}$/.test(clean) || !nr.trim()) return;
    setLookupBusy(true);
    setLookupMsg("");
    try {
      const res = await fetch(`/api/postcode-lookup?postcode=${encodeURIComponent(clean)}&huisnummer=${encodeURIComponent(nr.trim())}`);
      const data = await res.json();
      if (res.ok) {
        if (data.street) setStreet(data.street);
        if (data.city) setCity(data.city);
        setLookupMsg("✓ Adres gevonden");
      } else {
        setLookupMsg(data.error ?? "Geen adres gevonden");
      }
    } catch {
      setLookupMsg("Zoeken mislukt");
    } finally {
      setLookupBusy(false);
    }
  }

  function reset() {
    setCompanyName(""); setKvkNumber(""); setVatNumber("");
    setStatus("ACTIVE"); setPaymentTerm("DAYS_14"); setLanguage("NL"); setEmail("");
    setStreet(""); setHouseNumber(""); setPostalCode(""); setCity("");
    setCFirst(""); setCLast(""); setCEmail(""); setCPhone("");
    setLookupMsg(""); setError("");
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
          email: email.trim() || null,
          status,
          defaultPaymentTerm: paymentTerm,
          defaultLanguage: language,
          address: (street.trim() && city.trim())
            ? { street: street.trim(), houseNumber: houseNumber.trim(), postalCode: postalCode.trim(), city: city.trim() }
            : null,
          contact: (cFirst.trim() || cLast.trim())
            ? { firstName: cFirst.trim(), lastName: cLast.trim(), email: cEmail.trim() || null, phone: cPhone.trim() || null }
            : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? `Fout bij aanmaken (${res.status})`); return; }
      setOpen(false);
      router.push(`/customers/${data.id}`);
      router.refresh();
    } catch {
      setError("Netwerkfout — probeer opnieuw");
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
            <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme BV" autoFocus />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="E-mail (factuur/hoofd)">
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@acme.nl" />
            </FormField>
            <FormField label="Status">
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ACTIVE">Actief</option>
                <option value="PROSPECT">Prospect</option>
                <option value="INACTIVE">Inactief</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="KVK-nummer">
              <input className={inputClass} value={kvkNumber} onChange={(e) => setKvkNumber(e.target.value)} placeholder="12345678" />
            </FormField>
            <FormField label="BTW-nummer">
              <input className={inputClass} value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="NL123456789B01" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Betalingstermijn">
              <select className={inputClass} value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value)}>
                <option value="DAYS_14">14 dagen</option>
                <option value="DAYS_30">30 dagen</option>
                <option value="PREPAYMENT">Vooruitbetaling</option>
                <option value="INSTALLMENTS">In termijnen</option>
              </select>
            </FormField>
            <FormField label="Taal (offerte/factuur)">
              <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="NL">🇳🇱 Nederlands</option>
                <option value="EN">🇬🇧 Engels</option>
              </select>
            </FormField>
          </div>

          {/* Adres (optioneel) — postcode + huisnummer vult straat/plaats automatisch */}
          <div className="pt-2 mt-1 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Adres (optioneel)</p>
              {lookupMsg && (
                <span className={`text-xs ${lookupMsg.startsWith("✓") ? "text-green-600" : "text-amber-600"}`}>
                  {lookupBusy ? "Zoeken…" : lookupMsg}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Postcode">
                <input
                  className={inputClass}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  onBlur={(e) => lookupAddress(e.target.value, houseNumber)}
                  placeholder="1234 AB"
                />
              </FormField>
              <FormField label="Nr.">
                <input
                  className={inputClass}
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  onBlur={(e) => lookupAddress(postalCode, e.target.value)}
                  placeholder="12A"
                />
              </FormField>
              <FormField label="Plaats">
                <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Amsterdam" />
              </FormField>
              <div className="col-span-3">
                <FormField label="Straat">
                  <input className={inputClass} value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Dorpsstraat" />
                </FormField>
              </div>
            </div>
          </div>

          {/* Contactpersoon (optioneel) */}
          <div className="pt-2 mt-1 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contactpersoon (optioneel)</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Voornaam">
                <input className={inputClass} value={cFirst} onChange={(e) => setCFirst(e.target.value)} />
              </FormField>
              <FormField label="Achternaam">
                <input className={inputClass} value={cLast} onChange={(e) => setCLast(e.target.value)} />
              </FormField>
              <FormField label="E-mail">
                <input className={inputClass} type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
              </FormField>
              <FormField label="Telefoon">
                <input className={inputClass} value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
              </FormField>
            </div>
          </div>
        </CreateModal>
      )}
    </>
  );
}
