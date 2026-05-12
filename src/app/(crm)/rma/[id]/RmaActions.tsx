"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RmaStatus = "NEW" | "ASSIGNED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "RECEIVED" | "RESOLVED" | "CLOSED";
type RmaResolutionType = "CREDIT_NOTE" | "REPLACEMENT" | "REPAIR" | "REFUND" | "OTHER";

const STATUS_LABELS: Record<RmaStatus, string> = {
  NEW: "Nieuw",
  ASSIGNED: "Gekoppeld",
  IN_REVIEW: "In behandeling",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  RECEIVED: "Retour ontvangen",
  RESOLVED: "Opgelost",
  CLOSED: "Gesloten",
};

const RESOLUTION_LABELS: Record<RmaResolutionType, string> = {
  CREDIT_NOTE: "Creditnota",
  REPLACEMENT: "Vervanging",
  REPAIR: "Reparatie",
  REFUND: "Terugbetaling",
  OTHER: "Anders",
};

const STATUS_FLOW: RmaStatus[] = [
  "NEW", "ASSIGNED", "IN_REVIEW", "APPROVED", "REJECTED", "RECEIVED", "RESOLVED", "CLOSED",
];

interface Props {
  rma: {
    id: string;
    status: string;
    customerId: string | null;
    assignedTo: string | null;
    resolution: string | null;
    resolutionNotes: string | null | undefined;
    customer: { id: string; companyName: string; customerNumber: string } | null;
    assignedToUser: { id: string; name: string } | null;
  };
  customers: { id: string; companyName: string; customerNumber: string }[];
  users: { id: string; name: string }[];
}

const selectClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white";

export function RmaActions({ rma, customers, users }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState(rma.customerId ?? "");
  const [assignedTo, setAssignedTo] = useState(rma.assignedTo ?? "");
  const [status, setStatus] = useState<RmaStatus>(rma.status as RmaStatus);
  const [resolution, setResolution] = useState(rma.resolution ?? "");
  const [resolutionNotes, setResolutionNotes] = useState(rma.resolutionNotes ?? "");
  const [saved, setSaved] = useState(false);

  async function save(patch: Record<string, string | null>) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/rma/${rma.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleSaveAll() {
    await save({
      customerId: customerId || null,
      assignedTo: assignedTo || null,
      status,
      resolution: resolution || null,
      resolutionNotes,
    });
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Status
        </h2>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as RmaStatus)}
        >
          {STATUS_FLOW.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </section>

      {/* Klant koppelen */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Klant koppelen
        </h2>
        {rma.customer && (
          <div className="mb-2 text-xs text-slate-500 bg-slate-50 rounded px-3 py-2">
            Gekoppeld aan <strong>{rma.customer.companyName}</strong>
          </div>
        )}
        <select
          className={selectClass}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">— Niet gekoppeld —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName} ({c.customerNumber})
            </option>
          ))}
        </select>
      </section>

      {/* Toewijzen */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Toegewezen aan
        </h2>
        <select
          className={selectClass}
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        >
          <option value="">— Niet toegewezen —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </section>

      {/* Afhandeling */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Afhandeling
        </h2>
        <div className="space-y-3">
          <select
            className={selectClass}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          >
            <option value="">— Nog geen beslissing —</option>
            {Object.entries(RESOLUTION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
            rows={3}
            placeholder="Interne notitie over afhandeling…"
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
          />
        </div>
      </section>

      <button
        onClick={handleSaveAll}
        disabled={saving}
        className="w-full bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
      >
        {saving ? "Opslaan…" : saved ? "✓ Opgeslagen" : "Wijzigingen opslaan"}
      </button>
    </div>
  );
}
