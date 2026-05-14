"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Pencil, Check, X, User, Phone, CalendarDays, CheckSquare,
  Clock, AlertCircle, Trash2,
} from "lucide-react";

type UpcomingActivity = {
  id: string;
  type: string;
  title: string;
  dueAt: string | null;
  createdByUser: { name: string };
};

type DealInfo = {
  id: string;
  title: string;
  notes: string;
  customerId: string;
  customerName: string;
  primaryContactId: string | null;
  primaryContact: { id: string; name: string; role: string | null } | null;
  contacts: { id: string; name: string; role: string | null }[];
  createdByUser: { name: string };
  createdAt: string;
  openActivitiesCount: number;
  upcomingActivities: UpcomingActivity[];
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  CALL:    <Phone className="w-3.5 h-3.5" />,
  MEETING: <CalendarDays className="w-3.5 h-3.5" />,
  TASK:    <CheckSquare className="w-3.5 h-3.5" />,
};

const TYPE_COLORS: Record<string, string> = {
  CALL:    "bg-brand-blue-light text-brand-blue",
  MEETING: "bg-purple-100 text-purple-600",
  TASK:    "bg-amber-100 text-amber-600",
  NOTE:    "bg-slate-100 text-slate-500",
  EMAIL:   "bg-indigo-100 text-indigo-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatDue(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric", month: "short",
  });
}

function isOverdue(dueAt: string | null) {
  if (!dueAt) return false;
  return new Date(dueAt) < new Date();
}

// ─── Inline editable field ───────────────────────────────────────────────────
interface InlineFieldProps {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
}

function InlineField({ label, value, onSave, multiline, placeholder }: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  function cancel() { setDraft(value); setEditing(false); }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !multiline) { e.preventDefault(); save(); }
    if (e.key === "Escape") cancel();
  }

  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      {editing ? (
        <div className="flex items-start gap-2">
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              rows={4}
              className="flex-1 text-sm border border-brand-blue/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none"
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              className="flex-1 text-sm border border-brand-blue/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          )}
          <div className="flex flex-col gap-1 shrink-0 mt-0.5">
            <button
              onClick={save}
              disabled={saving}
              className="p-1.5 rounded-lg bg-brand-blue hover:bg-brand-blue-dark text-white transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={cancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="group flex items-start gap-2 cursor-pointer"
          onClick={() => { setDraft(value); setEditing(true); }}
        >
          <span className={`text-sm ${value ? "text-slate-800" : "text-slate-300 italic"}`}>
            {value || placeholder || "—"}
          </span>
          <Pencil className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors mt-0.5 shrink-0 opacity-0 group-hover:opacity-100" />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DealInfoClient({ deal }: { deal: DealInfo }) {
  const router = useRouter();
  const [title, setTitleState] = useState(deal.title);
  const [notes, setNotesState] = useState(deal.notes);
  const [contactId, setContactId] = useState(deal.primaryContactId ?? "");
  const [savingContact, setSavingContact] = useState(false);

  async function patchDeal(data: Record<string, unknown>) {
    await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
  }

  async function deleteDeal() {
    if (!window.confirm("Deal verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
    router.push("/deals");
  }

  async function saveTitle(v: string) {
    setTitleState(v);
    await patchDeal({ title: v });
  }

  async function saveNotes(v: string) {
    setNotesState(v);
    await patchDeal({ notes: v });
  }

  async function saveContact(id: string) {
    setContactId(id);
    setSavingContact(true);
    await patchDeal({ primaryContactId: id || null });
    setSavingContact(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

      {/* ── Left column: deal details ──────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">

        {/* Details card */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Dealgegevens</h3>
            <button
              onClick={deleteDeal}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Verwijderen
            </button>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">

            <InlineField
              label="Titel"
              value={title}
              onSave={saveTitle}
              placeholder="Dealomschrijving"
            />

            {/* Klant (niet bewerkbaar vanuit deal) */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Klant</p>
              <Link
                href={`/customers/${deal.customerId}`}
                className="text-sm text-brand-blue hover:underline"
              >
                {deal.customerName}
              </Link>
            </div>

            {/* Primaire contactpersoon */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Contactpersoon</p>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <select
                  value={contactId}
                  onChange={(e) => saveContact(e.target.value)}
                  disabled={savingContact}
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white disabled:opacity-60"
                >
                  <option value="">— Geen contactpersoon —</option>
                  {deal.contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.role ? ` · ${c.role}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Aangemaakt door / datum */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Aangemaakt</p>
              <p className="text-sm text-slate-600">
                {formatDate(deal.createdAt)}{" "}
                <span className="text-slate-400">door {deal.createdByUser.name}</span>
              </p>
            </div>

          </div>
        </div>

        {/* Notes card */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Opmerkingen</h3>
          </div>
          <div className="px-5 py-4">
            <InlineField
              label=""
              value={notes}
              onSave={saveNotes}
              multiline
              placeholder="Interne opmerkingen over deze deal…"
            />
          </div>
        </div>

      </div>

      {/* ── Right column: open activiteiten ────────────────────── */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Open activiteiten
            </h3>
            <Link
              href={`/deals/${deal.id}/activities`}
              className="text-xs text-brand-blue hover:text-brand-blue transition-colors"
            >
              Alle ({deal.openActivitiesCount}) →
            </Link>
          </div>

          {deal.upcomingActivities.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              Geen open taken
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {deal.upcomingActivities.map((a) => {
                const overdue = isOverdue(a.dueAt);
                return (
                  <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${TYPE_COLORS[a.type] ?? "bg-slate-100 text-slate-500"}`}>
                      {TYPE_ICONS[a.type] ?? <CheckSquare className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 font-medium truncate">{a.title}</p>
                      {a.dueAt && (
                        <p className={`mt-0.5 flex items-center gap-1 text-xs ${overdue ? "text-red-500 font-medium" : "text-slate-400"}`}>
                          {overdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {formatDue(a.dueAt)}
                          {overdue && " · verlopen"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-5 py-3 border-t border-slate-50">
            <Link
              href={`/deals/${deal.id}/activities`}
              className="text-xs text-brand-blue hover:text-brand-blue font-medium transition-colors"
            >
              + Activiteit toevoegen
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
