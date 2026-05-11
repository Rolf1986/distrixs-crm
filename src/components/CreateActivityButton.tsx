"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, MessageSquare, Phone, Users, Mail, CheckSquare } from "lucide-react";

type ActivityType = "NOTE" | "CALL" | "MEETING" | "EMAIL" | "TASK";

const TYPE_ICONS: Record<ActivityType, React.ReactNode> = {
  NOTE:    <MessageSquare className="w-3.5 h-3.5" />,
  CALL:    <Phone className="w-3.5 h-3.5" />,
  MEETING: <Users className="w-3.5 h-3.5" />,
  EMAIL:   <Mail className="w-3.5 h-3.5" />,
  TASK:    <CheckSquare className="w-3.5 h-3.5" />,
};

const TYPE_LABELS: Record<ActivityType, string> = {
  NOTE:    "Notitie",
  CALL:    "Bellen",
  MEETING: "Meeting",
  EMAIL:   "E-mail",
  TASK:    "Taak",
};

const HAS_DUE = new Set<ActivityType>(["TASK", "CALL", "MEETING"]);

interface Props {
  /** Pre-selected deal context (locks the deal selector) */
  dealId?: string;
  /** Pre-selected customer context */
  customerId?: string;
  /** List of deals for the linker dropdown */
  deals?: { id: string; dealNumber: string; title: string }[];
  /** List of customers for the linker dropdown */
  customers?: { id: string; companyName: string }[];
}

export function CreateActivityButton({ dealId, customerId, deals, customers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActivityType>("TASK");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [linkedDealId, setLinkedDealId] = useState(dealId ?? "");
  const [linkedCustomerId, setLinkedCustomerId] = useState(customerId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setType("TASK");
    setTitle("");
    setNotes("");
    setDueAt("");
    setLinkedDealId(dealId ?? "");
    setLinkedCustomerId(customerId ?? "");
    setError(null);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          notes: notes.trim() || undefined,
          dueAt: dueAt || undefined,
          dealId: linkedDealId || undefined,
          customerId: linkedCustomerId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Fout bij opslaan");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={openForm}
        className="flex items-center gap-1.5 px-3 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Activiteit
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Activiteit toevoegen</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Type
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(TYPE_LABELS) as ActivityType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    type === t
                      ? "border-blue-500 bg-brand-blue-light text-brand-blue"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {TYPE_ICONS[t]}
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Titel *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijv. Terugbellen over offerte"
              required
              autoFocus
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>

          {/* Due date (only for TASK/CALL/MEETING) */}
          {HAS_DUE.has(type) && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Deadline
              </label>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Toelichting
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optioneel"
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none"
            />
          </div>

          {/* Link to deal (if not pre-set and deals available) */}
          {!dealId && deals && deals.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Koppel aan deal
              </label>
              <select
                value={linkedDealId}
                onChange={(e) => setLinkedDealId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white"
              >
                <option value="">— Geen deal —</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dealNumber} · {d.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Link to customer (if not pre-set, no deal selected, and customers available) */}
          {!customerId && !linkedDealId && customers && customers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Koppel aan klant
              </label>
              <select
                value={linkedCustomerId}
                onChange={(e) => setLinkedCustomerId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white"
              >
                <option value="">— Geen klant —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </form>
    </div>
  );
}
