"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export function UnsubscribeClient({ token, productLabel }: { token: string; productLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unsubscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/firmware/public/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Er ging iets mis.");
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
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Je bent afgemeld</h2>
        <p className="text-sm text-slate-600">
          Je krijgt geen firmware-updates meer voor {productLabel}. Wil je je later opnieuw aanmelden, dan kan
          dat via <a href="/firmware-updates" className="text-blue-600">deze pagina</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8">
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Afmelden voor firmware-updates</h2>
      <p className="text-sm text-slate-600 mb-6">
        Je staat aangemeld voor updates van <strong>{productLabel}</strong>. Wil je die niet meer ontvangen?
      </p>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}
      <button
        onClick={unsubscribe}
        disabled={busy}
        className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors inline-flex items-center gap-2"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        Ja, meld mij af
      </button>
    </div>
  );
}
