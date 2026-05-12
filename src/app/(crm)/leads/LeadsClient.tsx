"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight, Plus, Loader2 } from "lucide-react";
import Link from "next/link";

type Lead = {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  estimatedValue: number | null;
  notes: string | null;
  convertedToCustomerId: string | null;
  assignedTo: string | null;
  assignedToUser: { id: string; name: string } | null;
  createdAt: string;
};

type User = { id: string; name: string };

const COLUMNS: { key: string; label: string }[] = [
  { key: "NEW", label: "Nieuw" },
  { key: "CONTACTED", label: "Gecontacteerd" },
  { key: "QUALIFIED", label: "Gekwalificeerd" },
  { key: "CONVERTED", label: "Geconverteerd" },
  { key: "LOST", label: "Verloren" },
];

const STATUS_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Aanbeveling",
  TRADE_SHOW: "Beurs",
  COLD_OUTREACH: "Cold outreach",
  SOCIAL_MEDIA: "Social media",
  OTHER: "Overig",
};

const SOURCE_COLORS: Record<string, string> = {
  WEBSITE: "bg-blue-100 text-blue-700",
  REFERRAL: "bg-green-100 text-green-700",
  TRADE_SHOW: "bg-purple-100 text-purple-700",
  COLD_OUTREACH: "bg-orange-100 text-orange-700",
  SOCIAL_MEDIA: "bg-pink-100 text-pink-700",
  OTHER: "bg-slate-100 text-slate-600",
};

const COLUMN_COLORS: Record<string, string> = {
  NEW: "border-t-slate-400",
  CONTACTED: "border-t-blue-400",
  QUALIFIED: "border-t-indigo-500",
  CONVERTED: "border-t-green-500",
  LOST: "border-t-red-400",
};

export function LeadsClient({
  leads: initialLeads,
  users,
}: {
  leads: Lead[];
  users: User[];
}) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    source: "OTHER",
    estimatedValue: "",
    notes: "",
    assignedTo: "",
  });

  async function moveToNext(lead: Lead) {
    const idx = STATUS_ORDER.indexOf(lead.status);
    if (idx === -1 || idx >= STATUS_ORDER.length - 1) return;
    const nextStatus = STATUS_ORDER[idx + 1];
    await updateStatus(lead, nextStatus);
  }

  async function updateStatus(lead: Lead, newStatus: string) {
    setMovingId(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeads((prev) =>
          prev.map((l) =>
            l.id === lead.id ? { ...l, status: updated.status, convertedToCustomerId: updated.convertedToCustomerId } : l
          )
        );
      }
    } finally {
      setMovingId(null);
    }
  }

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: createForm.companyName,
          contactName: createForm.contactName || undefined,
          email: createForm.email || undefined,
          phone: createForm.phone || undefined,
          source: createForm.source,
          estimatedValue: createForm.estimatedValue
            ? Number(createForm.estimatedValue)
            : undefined,
          notes: createForm.notes || undefined,
          assignedTo: createForm.assignedTo || undefined,
        }),
      });
      if (res.ok) {
        const newLead = await res.json();
        setLeads((prev) => [
          {
            id: newLead.id,
            companyName: newLead.companyName,
            contactName: newLead.contactName,
            email: newLead.email,
            phone: newLead.phone,
            source: newLead.source,
            status: newLead.status,
            estimatedValue: newLead.estimatedValue
              ? Number(newLead.estimatedValue)
              : null,
            notes: newLead.notes,
            convertedToCustomerId: newLead.convertedToCustomerId,
            assignedTo: newLead.assignedTo,
            assignedToUser: newLead.assignedToUser,
            createdAt: newLead.createdAt,
          },
          ...prev,
        ]);
        setShowCreate(false);
        setCreateForm({
          companyName: "",
          contactName: "",
          email: "",
          phone: "",
          source: "OTHER",
          estimatedValue: "",
          notes: "",
          assignedTo: "",
        });
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="px-8 py-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">
          {leads.length} leads totaal
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nieuwe lead
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Nieuwe lead aanmaken
            </h2>
            <form onSubmit={createLead} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">
                  Bedrijfsnaam *
                </label>
                <input
                  required
                  value={createForm.companyName}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      companyName: e.target.value,
                    }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Contactpersoon
                  </label>
                  <input
                    value={createForm.contactName}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        contactName: e.target.value,
                      }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Bron *
                  </label>
                  <select
                    required
                    value={createForm.source}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, source: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(SOURCE_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Telefoon
                  </label>
                  <input
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Geschatte waarde (EUR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.estimatedValue}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        estimatedValue: e.target.value,
                      }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Toegewezen aan
                  </label>
                  <select
                    value={createForm.assignedTo}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        assignedTo: e.target.value,
                      }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Niemand —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">
                  Notities
                </label>
                <textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Aanmaken
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="grid grid-cols-5 gap-4 overflow-x-auto min-w-0">
        {COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.key);
          const totalValue = colLeads.reduce(
            (s, l) => s + (l.estimatedValue ?? 0),
            0
          );

          return (
            <div key={col.key} className="min-w-[200px]">
              {/* Column header */}
              <div
                className={`bg-white border border-slate-200 border-t-4 rounded-lg px-3 py-2.5 mb-3 ${COLUMN_COLORS[col.key]}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    {col.label}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                    {colLeads.length}
                  </span>
                </div>
                {totalValue > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatCurrency(totalValue)}
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {colLeads.map((lead) => {
                  const currentIdx = STATUS_ORDER.indexOf(lead.status);
                  const hasNext = currentIdx < STATUS_ORDER.length - 1;
                  const nextStatus =
                    hasNext ? STATUS_ORDER[currentIdx + 1] : null;
                  const nextLabel = nextStatus
                    ? COLUMNS.find((c) => c.key === nextStatus)?.label
                    : null;
                  const isMoving = movingId === lead.id;

                  return (
                    <div
                      key={lead.id}
                      className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <p className="text-sm font-semibold text-slate-800 leading-tight">
                        {lead.companyName}
                      </p>
                      {lead.contactName && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {lead.contactName}
                        </p>
                      )}
                      {lead.estimatedValue != null && (
                        <p className="text-xs font-medium text-blue-600 mt-1">
                          {formatCurrency(lead.estimatedValue)}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span
                          className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${SOURCE_COLORS[lead.source] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {SOURCE_LABELS[lead.source] ?? lead.source}
                        </span>
                        {lead.assignedToUser && (
                          <span className="text-[11px] text-slate-400">
                            {lead.assignedToUser.name}
                          </span>
                        )}
                      </div>

                      {/* Converted: link to customer */}
                      {lead.status === "CONVERTED" &&
                        lead.convertedToCustomerId && (
                          <Link
                            href={`/customers/${lead.convertedToCustomerId}`}
                            className="mt-2 text-[11px] text-green-700 font-medium underline underline-offset-2 block"
                          >
                            Bekijk klant
                          </Link>
                        )}

                      {/* Move to next button */}
                      {hasNext && nextLabel && lead.status !== "CONVERTED" && lead.status !== "LOST" && (
                        <button
                          onClick={() => moveToNext(lead)}
                          disabled={isMoving}
                          className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded py-1 transition-colors disabled:opacity-50"
                        >
                          {isMoving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          Naar {nextLabel}
                        </button>
                      )}
                      {/* Allow marking as LOST from any non-terminal state */}
                      {lead.status !== "CONVERTED" && lead.status !== "LOST" && (
                        <button
                          onClick={() => updateStatus(lead, "LOST")}
                          disabled={isMoving}
                          className="mt-1 w-full text-[11px] text-red-400 hover:text-red-600 border border-transparent hover:border-red-200 rounded py-0.5 transition-colors disabled:opacity-50"
                        >
                          Markeer als verloren
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
