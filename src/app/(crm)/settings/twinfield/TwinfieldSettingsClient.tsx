"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Send,
  Loader2,
  RefreshCw,
} from "lucide-react";

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
  transactionType: string;
  debtorAccount: string;
  revenueAccount: string;
  vatCode: string;
  autoSync: boolean;
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
  transactionType: initialTransactionType,
  debtorAccount: initialDebtorAccount,
  revenueAccount: initialRevenueAccount,
  vatCode: initialVatCode,
  autoSync: initialAutoSync,
  tokenExpiresAt,
  recentInvoices,
  flash,
}: Props) {
  const [officeCode, setOfficeCode] = useState(initialOfficeCode);
  const [transactionType, setTransactionType] = useState(initialTransactionType);
  const [debtorAccount, setDebtorAccount] = useState(initialDebtorAccount);
  const [revenueAccount, setRevenueAccount] = useState(initialRevenueAccount);
  const [vatCode, setVatCode] = useState(initialVatCode);
  const [autoSync, setAutoSync] = useState(initialAutoSync);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<{
    transactionTypes: string[];
    vatCodes: string[];
  } | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  async function handleManualSync(invoiceId: string) {
    setSyncingId(invoiceId);
    setSyncResults((r) => ({ ...r, [invoiceId]: { ok: false, msg: "Bezig…" } }));
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/twinfield-sync`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        success?: boolean;
        reference?: string;
        error?: string;
      };
      if (data.success) {
        setSyncResults((r) => ({
          ...r,
          [invoiceId]: {
            ok: true,
            msg: `Gesynchroniseerd${data.reference ? ` — ref: ${data.reference}` : ""}`,
          },
        }));
      } else {
        setSyncResults((r) => ({
          ...r,
          [invoiceId]: { ok: false, msg: data.error ?? "Fout" },
        }));
      }
    } catch {
      setSyncResults((r) => ({
        ...r,
        [invoiceId]: { ok: false, msg: "Netwerkfout" },
      }));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/settings/twinfield", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twinfield_office_code: officeCode,
          twinfield_transaction_type: transactionType,
          twinfield_debtor_account: debtorAccount,
          twinfield_revenue_account: revenueAccount,
          twinfield_vat_code: vatCode,
          twinfield_auto_sync: autoSync,
        }),
      });
      if (res.ok) {
        setSavedMsg("Instellingen opgeslagen.");
      } else {
        const data = (await res.json()) as { error?: string };
        setSavedMsg(`Fout: ${data.error ?? "Onbekend"}`);
      }
    } catch {
      setSavedMsg("Netwerkfout bij opslaan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscoverCodes() {
    setDiscovering(true);
    setDiscoverError(null);
    setDiscovered(null);
    try {
      const res = await fetch("/api/twinfield/setup");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setDiscoverError(data.error ?? "Fout bij ophalen codes");
        return;
      }
      const data = (await res.json()) as {
        transactionTypes: string[];
        vatCodes: string[];
      };
      setDiscovered(data);
    } catch {
      setDiscoverError("Netwerkfout bij ophalen codes");
    } finally {
      setDiscovering(false);
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

      {/* Twinfield instellingen */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Twinfield boekhoudingsinstellingen
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Vul de codes in die overeenkomen met uw Twinfield-administratie.
              Gebruik de knop &quot;Haal codes op&quot; om beschikbare codes op te halen.
            </p>
          </div>
          {connected && (
            <button
              type="button"
              onClick={handleDiscoverCodes}
              disabled={discovering}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 border border-blue-200 rounded px-3 py-1.5 transition-colors shrink-0"
            >
              {discovering ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Haal codes op
            </button>
          )}
        </div>

        {discoverError && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {discoverError}
          </div>
        )}

        {discovered && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
            <p className="font-medium mb-1">Beschikbare codes uit Twinfield:</p>
            {discovered.transactionTypes.length > 0 && (
              <p>
                <span className="font-medium">Verkoopboek codes:</span>{" "}
                {discovered.transactionTypes.join(", ")}
              </p>
            )}
            {discovered.vatCodes.length > 0 && (
              <p className="mt-0.5">
                <span className="font-medium">BTW-codes:</span>{" "}
                {discovered.vatCodes.join(", ")}
              </p>
            )}
            {discovered.transactionTypes.length === 0 && discovered.vatCodes.length === 0 && (
              <p className="text-slate-500">Automatisch ophalen niet beschikbaar voor deze administratie. Vul de codes handmatig in.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-4">
          {/* Office code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Office code
              </label>
              <input
                type="text"
                value={officeCode}
                onChange={(e) => setOfficeCode(e.target.value)}
                placeholder="Bijv. DIST"
                className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-0.5">
                Kantoorcode van uw Twinfield-administratie
              </p>
            </div>

            {/* Transaction type */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Verkoopboek code
              </label>
              <input
                type="text"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                placeholder="Bijv. VRK"
                className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-0.5">
                Dagboekcode voor verkoopfacturen
              </p>
            </div>

            {/* Debtor account */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Debiteurenrekening
              </label>
              <input
                type="text"
                value={debtorAccount}
                onChange={(e) => setDebtorAccount(e.target.value)}
                placeholder="Bijv. 1300"
                className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-0.5">
                Balansrekening voor debiteuren
              </p>
            </div>

            {/* Revenue account */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Omzetrekening
              </label>
              <input
                type="text"
                value={revenueAccount}
                onChange={(e) => setRevenueAccount(e.target.value)}
                placeholder="Bijv. 8000"
                className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-0.5">
                Resultaatrekening voor omzet
              </p>
            </div>

            {/* VAT code */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                BTW-code
              </label>
              <input
                type="text"
                value={vatCode}
                onChange={(e) => setVatCode(e.target.value)}
                placeholder="Bijv. VH"
                className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-0.5">
                BTW-code voor verkoopfacturen (bijv. VH = hoog 21%)
              </p>
            </div>
          </div>

          {/* Automatische sync aan/uit */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 mt-2">
            <div>
              <p className="text-sm font-medium text-slate-800">Automatisch naar Twinfield bij verzenden</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Staat dit aan, dan wordt een factuur bij het versturen (of op ‘Verzonden’ zetten) automatisch als concept-boeking naar Twinfield gestuurd. Uit = alleen handmatig via de knop op de factuur.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoSync((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${autoSync ? "bg-brand-blue" : "bg-slate-300"}`}
              role="switch"
              aria-checked={autoSync}
              title={autoSync ? "Auto-sync staat aan" : "Auto-sync staat uit"}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${autoSync ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Opslaan…" : "Instellingen opslaan"}
            </button>
            {savedMsg && (
              <span className="text-xs text-slate-600">{savedMsg}</span>
            )}
          </div>
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
                <th className="pb-2 pr-4">Gewijzigd</th>
                <th className="pb-2">Actie</th>
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
                    <td className="py-2 pr-4 text-xs text-slate-400">
                      {new Date(inv.updatedAt).toLocaleDateString("nl-NL")}
                    </td>
                    <td className="py-2">
                      {syncResults[inv.id] ? (
                        <span
                          className={`text-xs ${
                            syncResults[inv.id].ok
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {syncResults[inv.id].msg}
                        </span>
                      ) : !inv.twinfieldLocked && connected ? (
                        <button
                          onClick={() => handleManualSync(inv.id)}
                          disabled={syncingId === inv.id}
                          className="inline-flex items-center gap-1 text-xs text-brand-blue hover:text-brand-blue-dark disabled:opacity-50 border border-brand-blue/30 rounded px-2 py-1 transition-colors"
                        >
                          {syncingId === inv.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Stuur naar Twinfield
                        </button>
                      ) : inv.twinfieldLocked ? (
                        <span className="text-xs text-slate-400">Geblokkeerd</span>
                      ) : null}
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
              de boekhoudingsinstellingen zijn geconfigureerd.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
