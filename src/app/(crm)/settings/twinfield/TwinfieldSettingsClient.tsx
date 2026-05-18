"use client";

import { useState } from "react";
import { CheckCircle, XCircle, AlertCircle, ExternalLink } from "lucide-react";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  twinfieldSyncStatus: string;
  twinfieldLocked: boolean;
  twinfieldReference: string | null;
  updatedAt: string;
};

type Props = {
  connected: boolean;
  officeCode: string;
  tokenExpiresAt: string | null;
  recentInvoices: InvoiceRow[];
  flash: "success" | string | null;
};

const SYNC_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  NOT_SYNCED: { label: "Niet gesynchroniseerd", className: "text-slate-500" },
  PENDING: { label: "In behandeling", className: "text-yellow-600" },
  SYNCED: { label: "Gesynchroniseerd", className: "text-green-600" },
  ERROR: { label: "Fout", className: "text-red-600" },
};

export function TwinfieldSettingsClient({
  connected,
  officeCode: initialOfficeCode,
  tokenExpiresAt,
  recentInvoices,
  flash,
}: Props) {
  const [officeCode, setOfficeCode] = useState(initialOfficeCode);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function handleSaveOfficeCode(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/settings/twinfield", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twinfield_office_code: officeCode }),
      });
      if (res.ok) {
        setSavedMsg("Office code opgeslagen.");
      } else {
        const data = await res.json() as { error?: string };
        setSavedMsg(`Fout: ${data.error ?? "Onbekend"}`);
      }
    } catch {
      setSavedMsg("Netwerkfout bij opslaan.");
    } finally {
      setSaving(false);
    }
  }

  const expiresAt = tokenExpiresAt ? new Date(tokenExpiresAt) : null;
  const isExpiringSoon =
    expiresAt && expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Flash messages */}
      {flash === "success" && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Succesvol verbonden met Twinfield.
        </div>
      )}
      {flash && flash !== "success" && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          {flash}
        </div>
      )}

      {/* Connection status card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          Verbindingsstatus
        </h2>

        <div className="flex items-center gap-3 mb-4">
          {connected ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-700">
                Verbonden met Twinfield
              </span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium text-red-700">
                Niet verbonden
              </span>
            </>
          )}
        </div>

        {connected && expiresAt && (
          <p className="text-xs text-slate-500 mb-4">
            Token geldig tot:{" "}
            <span className={isExpiringSoon ? "text-orange-600 font-medium" : ""}>
              {expiresAt.toLocaleString("nl-NL")}
            </span>
            {isExpiringSoon && " — verloopt binnenkort, herverbinden aanbevolen"}
          </p>
        )}

        <a
          href="/api/twinfield/auth"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {connected ? "Herverbinden met Twinfield" : "Verbinden met Twinfield"}
        </a>
      </div>

      {/* Office code */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">
          Twinfield office code
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          De kantoorcode van uw Twinfield-administratie (bijv. <code>DIST</code>).
          Wordt automatisch ingevuld na het verbinden als Twinfield dit meestuurt.
        </p>

        <form onSubmit={handleSaveOfficeCode} className="flex items-center gap-3">
          <input
            type="text"
            value={officeCode}
            onChange={(e) => setOfficeCode(e.target.value)}
            placeholder="Bijv. DIST"
            className="border border-slate-300 rounded-md px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
          {savedMsg && (
            <span className="text-xs text-slate-600">{savedMsg}</span>
          )}
        </form>
      </div>

      {/* Recent invoices sync status */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          Recente facturen — synchronisatiestatus
        </h2>

        {recentInvoices.length === 0 ? (
          <p className="text-sm text-slate-500">Geen facturen gevonden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="pb-2 pr-4">Factuurnummer</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Twinfield</th>
                <th className="pb-2 pr-4">Referentie</th>
                <th className="pb-2">Gewijzigd</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => {
                const syncMeta =
                  SYNC_STATUS_LABELS[inv.twinfieldSyncStatus] ??
                  SYNC_STATUS_LABELS.NOT_SYNCED;
                return (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-2 pr-4 font-mono text-xs text-slate-700">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-600">
                      {inv.status}
                    </td>
                    <td className={`py-2 pr-4 text-xs font-medium ${syncMeta.className}`}>
                      {syncMeta.label}
                      {inv.twinfieldLocked && (
                        <span className="ml-1 text-slate-400">(geblokkeerd)</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-500 font-mono">
                      {inv.twinfieldReference ?? "—"}
                    </td>
                    <td className="py-2 text-xs text-slate-400">
                      {new Date(inv.updatedAt).toLocaleDateString("nl-NL")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!connected && (
          <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Facturen worden pas gesynchroniseerd nadat Twinfield is verbonden en
              een office code is ingesteld.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
