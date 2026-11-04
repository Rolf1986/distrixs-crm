"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Merge, X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface Props {
  customerId: string;
  companyName: string;
  customerNumber: string;
  customers: { id: string; companyName: string; customerNumber: string }[];
}

// Dubbele klant laten opgaan in deze klant: alles verhuist hierheen,
// het duplicaat (en zijn klantnummer) verdwijnt.
export function MergeCustomerButton({ customerId, companyName, customerNumber, customers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [duplicateId, setDuplicateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicate = customers.find((c) => c.id === duplicateId);

  async function merge() {
    if (!duplicateId || !duplicate) return;
    const confirmed = window.confirm(
      `"${duplicate.companyName}" (${duplicate.customerNumber}) laten opgaan in ` +
        `"${companyName}" (${customerNumber})?\n\n` +
        "Alle deals, documenten, contacten en adressen verhuizen hierheen; " +
        `${duplicate.customerNumber} wordt daarna verwijderd.\n\n` +
        "Dit kan niet ongedaan worden gemaakt."
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/customers/${customerId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateId }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Samenvoegen mislukt");
      return;
    }
    setOpen(false);
    setDuplicateId("");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Merge className="w-4 h-4" />
        Samenvoegen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900">Klant samenvoegen</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              Kies het duplicaat dat moet opgaan in <span className="font-medium text-slate-700">{companyName}</span> ({customerNumber}).
              Alle deals, documenten, contacten en adressen verhuizen hierheen; het duplicaat wordt daarna verwijderd.
            </p>
            <SearchableSelect
              options={customers.map((c) => ({ id: c.id, label: c.companyName, sub: c.customerNumber }))}
              value={duplicateId}
              onChange={setDuplicateId}
              placeholder="Zoek het duplicaat…"
            />
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={merge}
                disabled={!duplicateId || busy}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-brand-blue text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? "Bezig…" : "Samenvoegen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
