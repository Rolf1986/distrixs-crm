"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";

interface ImportCounts {
  products: number;
  customers: number;
  contacts: number;
  deals: number;
  quotes: number;
  invoices: number;
  invoicesUpdated?: number;
  creditNotes?: number;
}

interface ImportResult {
  imported?: ImportCounts;
  error?: string;
}

function ImportPageInner() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected") === "true";
  const oauthError = searchParams.get("error");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleImport() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/teamleader/import", { method: "POST" });
      const data = (await res.json()) as ImportResult;
      setResult(data);
    } catch {
      setResult({ error: "Netwerk- of serverfout." });
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="max-w-2xl space-y-6">
      {/* Connection status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Teamleader Focus koppeling</h2>

        {oauthError && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Koppeling mislukt: <strong>{oauthError}</strong>. Probeer opnieuw.</span>
          </div>
        )}

        {connected && !oauthError && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Teamleader succesvol gekoppeld.</span>
          </div>
        )}

        <p className="text-sm text-slate-600">
          Koppel je Teamleader Focus account via OAuth. Na het koppelen kun je klanten, deals,
          offertes en facturen importeren.
        </p>

        <a
          href="/api/teamleader/auth"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#0170B9" }}
        >
          <ExternalLink className="w-4 h-4" />
          {connected ? "Opnieuw koppelen" : "Koppel Teamleader"}
        </a>
      </div>

      {/* Import section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Data importeren</h2>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Dit overschrijft geen bestaande data (veilig om meerdere keren uit te voeren).
            Bestaande records worden overgeslagen op basis van hun Teamleader-ID.
          </span>
        </div>

        <p className="text-sm text-slate-600">
          De import haalt op in volgorde: producten → klanten → contacten → deals →
          offertes → facturen.
        </p>

        <button
          onClick={handleImport}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: "#0170B9" }}
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Importeren…
            </>
          ) : (
            "Start import"
          )}
        </button>

        {result && (
          <div className="mt-4">
            {result.error ? (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{result.error}</span>
              </div>
            ) : result.imported ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Import voltooid
                </div>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {(
                      [
                        ["Producten", result.imported.products, "nieuw"],
                        ["Klanten", result.imported.customers, "nieuw"],
                        ["Contacten", result.imported.contacts, "nieuw"],
                        ["Deals", result.imported.deals, "nieuw"],
                        ["Offertes", result.imported.quotes, "nieuw"],
                        ["Facturen", result.imported.invoices, "nieuw"],
                        ["Facturen bijgewerkt", result.imported.invoicesUpdated ?? 0, "bijgewerkt"],
                        ["Creditnota's", result.imported.creditNotes ?? 0, "nieuw"],
                      ] as [string, number, string][]
                    ).map(([label, count, suffix]) => (
                      <tr key={label} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 text-slate-600">{label}</td>
                        <td className="py-1.5 text-right font-mono font-medium text-slate-900">
                          {count} {suffix}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense>
      <ImportPageInner />
    </Suspense>
  );
}
