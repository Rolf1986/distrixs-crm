"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, CheckCircle2, AlertTriangle, Navigation } from "lucide-react";

export function PaymentSettingsClient({
  keyConfigured,
  keyMode,
  keyHint,
  myparcelConfigured = false,
  myparcelHint = null,
}: {
  keyConfigured: boolean;
  keyMode: "live" | "test" | null;
  keyHint: string | null;
  myparcelConfigured?: boolean;
  myparcelHint?: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [mpValue, setMpValue] = useState("");
  const [mpSaving, setMpSaving] = useState(false);
  const [mpMessage, setMpMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function saveMyparcel(newKey: string) {
    setMpSaving(true); setMpMessage(null);
    try {
      const res = await fetch("/api/settings/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ myparcelApiKey: newKey }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setMpMessage({ type: "error", text: data.error ?? "Opslaan mislukt" }); return; }
      setMpMessage({ type: "ok", text: newKey ? "MyParcel-sleutel opgeslagen" : "MyParcel-sleutel verwijderd" });
      setMpValue("");
      router.refresh();
    } catch {
      setMpMessage({ type: "error", text: "Netwerk- of serverfout" });
    } finally {
      setMpSaving(false);
    }
  }

  async function save(newKey: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mollieApiKey: newKey }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Opslaan mislukt" });
        return;
      }
      setMessage({ type: "ok", text: newKey ? "Mollie-key opgeslagen" : "Mollie-key verwijderd" });
      setValue("");
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Netwerk- of serverfout" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand-blue" />
          <h2 className="text-base font-semibold text-slate-900">Mollie — online betalingen</h2>
        </div>
        <p className="text-sm text-slate-500">
          Met een Mollie API-key kunnen klanten facturen online betalen: de knop
          &ldquo;Betaal online&rdquo; in factuur-e-mails en de betaallink op de factuurpagina.
          Je vindt de key in het Mollie-dashboard onder{" "}
          <span className="font-medium text-slate-700">Instellingen → Website-profielen → API-keys</span>.
        </p>

        {/* Huidige status */}
        <div
          className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
            keyConfigured
              ? keyMode === "live"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-slate-50 border-slate-200 text-slate-600"
          }`}
        >
          {keyConfigured ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>
            {keyConfigured ? (
              <>
                Key ingesteld ({keyHint}) —{" "}
                {keyMode === "live" ? (
                  <strong>live-modus: echte betalingen</strong>
                ) : (
                  <strong>test-modus: geen echte betalingen</strong>
                )}
              </>
            ) : (
              "Nog geen Mollie-key ingesteld — betaallinks zijn uitgeschakeld."
            )}
          </span>
        </div>

        {/* Invoer */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-600">
            {keyConfigured ? "Nieuwe key (vervangt de huidige)" : "API-key"}
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="live_… of test_…"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              autoComplete="off"
            />
            <button
              onClick={() => save(value.trim())}
              disabled={saving || !value.trim()}
              className="px-4 py-2 rounded-lg bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue-dark disabled:opacity-50 transition-colors"
            >
              {saving ? "Bezig…" : "Opslaan"}
            </button>
          </div>
          {keyConfigured && (
            <button
              onClick={() => {
                if (confirm("Mollie-key verwijderen? Betaallinks werken dan niet meer.")) save("");
              }}
              disabled={saving}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              Key verwijderen
            </button>
          )}
        </div>

        {message && (
          <p className={`text-sm ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* MyParcel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-brand-blue" />
          <h2 className="text-base font-semibold text-slate-900">MyParcel — verzendlabels</h2>
        </div>
        <p className="text-sm text-slate-500">
          Met een MyParcel API-sleutel kun je vanuit een verzenddocument direct een label aanmaken
          (DHL Europlus, PostNL e.a.), met keuze voor het aantal pakketten; de tracking staat dan meteen goed.
          De sleutel vind je in je MyParcel-account onder <span className="font-medium text-slate-700">Instellingen → API</span>.
        </p>

        <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${myparcelConfigured ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
          {myparcelConfigured ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{myparcelConfigured ? <>Sleutel ingesteld ({myparcelHint}).</> : "Nog geen MyParcel-sleutel — labels aanmaken is uitgeschakeld."}</span>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-600">{myparcelConfigured ? "Nieuwe sleutel (vervangt de huidige)" : "API-sleutel"}</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={mpValue}
              onChange={(e) => setMpValue(e.target.value)}
              placeholder="MyParcel API-sleutel"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              autoComplete="off"
            />
            <button
              onClick={() => saveMyparcel(mpValue.trim())}
              disabled={mpSaving || !mpValue.trim()}
              className="px-4 py-2 rounded-lg bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue-dark disabled:opacity-50 transition-colors"
            >
              {mpSaving ? "Bezig…" : "Opslaan"}
            </button>
          </div>
          {myparcelConfigured && (
            <button
              onClick={() => { if (confirm("MyParcel-sleutel verwijderen?")) saveMyparcel(""); }}
              disabled={mpSaving}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              Sleutel verwijderen
            </button>
          )}
        </div>
        {mpMessage && (
          <p className={`text-sm ${mpMessage.type === "ok" ? "text-green-700" : "text-red-600"}`}>{mpMessage.text}</p>
        )}
      </div>
    </div>
  );
}
