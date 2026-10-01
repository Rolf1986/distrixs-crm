"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// AVG-verwijderverzoek: wist persoonsgegevens (contacten, mails,
// activiteiten, notities), zakelijke gegevens blijven. Onomkeerbaar.
export function AnonymizeCustomerButton({
  customerId,
  companyName,
  anonymizedAt,
}: {
  customerId: string;
  companyName: string;
  anonymizedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (anonymizedAt) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-sm text-slate-500">
          🔒 Deze klant is op {new Date(anonymizedAt).toLocaleDateString("nl-NL")} geanonimiseerd
          (AVG). Persoonsgegevens zijn gewist; facturen en offertes blijven bewaard voor de
          fiscale bewaarplicht.
        </p>
      </div>
    );
  }

  async function anonymize() {
    const confirmed = window.confirm(
      `Persoonsgegevens van "${companyName}" definitief wissen?\n\n` +
        "Dit verwijdert: contactpersoonsgegevens, gekoppelde e-mails, " +
        "activiteiten/notities en persoonsdata in retouren en leads.\n" +
        "Facturen, offertes en bedrijfsgegevens blijven bewaard (fiscale bewaarplicht).\n\n" +
        "Dit kan NIET ongedaan worden gemaakt."
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/customers/${customerId}/anonymize`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Anonimiseren mislukt");
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border border-red-100 p-6">
      <h2 className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-2">
        AVG / privacy
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Wist bij een verwijderverzoek alle persoonsgegevens van deze klant. Facturen en
        offertes blijven bewaard (7 jaar fiscale bewaarplicht). Onomkeerbaar.
      </p>
      <button
        onClick={anonymize}
        disabled={busy}
        className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? "Bezig…" : "Persoonsgegevens anonimiseren"}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
