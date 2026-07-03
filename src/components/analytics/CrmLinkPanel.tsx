"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Link2, Link2Off, Check, Building2, Lightbulb } from "lucide-react";

type Customer = { id: string; label: string; sub?: string; contacts: { id: string; label: string }[] };
type Suggestion = {
  customerId: string;
  customerLabel: string;
  contactId?: string;
  contactLabel?: string;
} | null;

interface Props {
  accountId: string;
  linkStatus: "UNLINKED" | "SUGGESTED" | "CONFIRMED";
  linkedCustomerLabel?: string | null;
  linkedContactLabel?: string | null;
  customers: Customer[];
  suggestion: Suggestion;
}

export function CrmLinkPanel({
  accountId,
  linkStatus,
  linkedCustomerLabel,
  linkedContactLabel,
  customers,
  suggestion,
}: Props) {
  const router = useRouter();
  const isLinked = linkStatus === "CONFIRMED" && !!linkedCustomerLabel;

  const [editing, setEditing] = useState(false);
  const [customerId, setCustomerId] = useState(suggestion?.customerId ?? "");
  const [contactId, setContactId] = useState(suggestion?.contactId ?? "");
  const [busy, setBusy] = useState(false);

  const contactOptions = customers.find((c) => c.id === customerId)?.contacts ?? [];

  async function save(payload: { customerId: string | null; contactId: string | null }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/analytics/accounts/${accountId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Gekoppeld ────────────────────────────────────────────────────────────────
  if (isLinked && !editing) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-green-100 text-green-600">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{linkedCustomerLabel}</p>
              {linkedContactLabel && <p className="text-xs text-slate-500">{linkedContactLabel}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1"
            >
              Wijzigen
            </button>
            <button
              onClick={() => save({ customerId: null, contactId: null })}
              disabled={busy}
              className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 flex items-center gap-1 disabled:opacity-60"
            >
              <Link2Off className="w-3.5 h-3.5" /> Ontkoppelen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Suggestie (nog niet bevestigd) ────────────────────────────────────────────
  if (suggestion && !editing && !isLinked) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-full bg-amber-100 text-amber-600 shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-700">
              Mogelijk dezelfde persoon (zelfde e-mailadres):{" "}
              <span className="font-medium text-slate-900">{suggestion.customerLabel}</span>
              {suggestion.contactLabel && (
                <span className="text-slate-500"> · {suggestion.contactLabel}</span>
              )}
            </p>
            <p className="text-xs text-amber-700/80 mt-0.5">Controleer en bevestig — of kies zelf een klant.</p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={() =>
                  save({ customerId: suggestion.customerId, contactId: suggestion.contactId ?? null })
                }
                disabled={busy}
                className="text-xs font-medium bg-brand-blue hover:bg-brand-blue-dark text-white px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" /> Bevestigen
              </button>
              <button
                onClick={() => {
                  setCustomerId(suggestion.customerId);
                  setContactId(suggestion.contactId ?? "");
                  setEditing(true);
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1.5"
              >
                Andere kiezen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Handmatig koppelen ────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 space-y-2.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5" /> Koppel aan CRM-klant
      </p>
      <SearchableSelect
        options={customers}
        value={customerId}
        onChange={(id) => {
          setCustomerId(id);
          setContactId("");
        }}
        placeholder="Zoek een klant…"
      />
      {customerId && contactOptions.length > 0 && (
        <SearchableSelect
          options={contactOptions}
          value={contactId}
          onChange={setContactId}
          placeholder="Contactpersoon (optioneel)…"
        />
      )}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={() => save({ customerId, contactId: contactId || null })}
          disabled={busy || !customerId}
          className="text-xs font-medium bg-brand-blue hover:bg-brand-blue-dark text-white px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-40"
        >
          <Check className="w-3.5 h-3.5" /> Koppelen
        </button>
        {(isLinked || suggestion) && (
          <button
            onClick={() => setEditing(false)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1.5"
          >
            Annuleren
          </button>
        )}
      </div>
    </div>
  );
}
