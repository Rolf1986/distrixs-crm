"use client";

import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export interface FirmwareProductOption {
  id: string;
  label: string;
  latestVersion: string | null;
}

export function SubscribeForm({ products }: { products: FirmwareProductOption[] }) {
  const [query, setQuery] = useState("");
  const [firmwareProductId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [serialNumber, setSerial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Er zijn honderden producten; filteren op tikwerk houdt de lijst bruikbaar.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? products.filter((p) => p.label.toLowerCase().includes(q)) : products;
    return base.slice(0, 60);
  }, [products, query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/firmware/public/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmwareProductId, email, name, companyName, serialNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Er ging iets mis. Probeer het opnieuw.");
        return;
      }
      setDone(true);
    } catch {
      setError("Verbindingsfout. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Aanmelding ontvangen</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          We nemen je aanmelding door en zetten hem klaar. Vanaf dat moment krijg je automatisch bericht zodra
          de fabrikant nieuwe firmware publiceert voor dit product.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Product <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op productnaam, bv. ZEUS of XP 500…"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          required
          value={firmwareProductId}
          onChange={(e) => setProductId(e.target.value)}
          size={8}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Kies je armatuur —</option>
          {filtered.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.latestVersion ? ` — nu ${p.latestVersion}` : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1.5">
          Staat je product er niet bij? Mail ons op{" "}
          <a href="mailto:info@distrixs.nl" className="text-blue-600">
            info@distrixs.nl
          </a>
          , dan zetten we het voor je klaar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Naam</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Bedrijf</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          E-mailadres <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Serienummer (optioneel)</label>
        <input
          type="text"
          value={serialNumber}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="Helpt ons bij vragen over jouw specifieke uitvoering"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy || !firmwareProductId}
        className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        Houd mij op de hoogte
      </button>

      <p className="text-xs text-slate-400 leading-relaxed">
        We gebruiken je gegevens alleen om je over firmware van dit product te informeren. Afmelden kan met
        één klik onderaan elke mail.
      </p>
    </form>
  );
}
