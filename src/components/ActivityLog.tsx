"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Phone, Users, Mail, CheckSquare, Plus, Clock, CheckCircle2, X } from "lucide-react";

type ActivityType = "NOTE" | "CALL" | "MEETING" | "EMAIL" | "TASK";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  notes: string | null;
  status: string;
  dueAt: Date | string | null;
  createdAt: Date | string;
  createdByUser: { name: string };
}

const TYPE_ICONS: Record<ActivityType, React.ReactNode> = {
  NOTE:    <MessageSquare className="w-3.5 h-3.5" />,
  CALL:    <Phone className="w-3.5 h-3.5" />,
  MEETING: <Users className="w-3.5 h-3.5" />,
  EMAIL:   <Mail className="w-3.5 h-3.5" />,
  TASK:    <CheckSquare className="w-3.5 h-3.5" />,
};

const TYPE_COLORS: Record<ActivityType, string> = {
  NOTE:    "bg-slate-100 text-slate-600",
  CALL:    "bg-brand-blue-light text-brand-blue",
  MEETING: "bg-purple-100 text-purple-600",
  EMAIL:   "bg-indigo-100 text-indigo-600",
  TASK:    "bg-amber-100 text-amber-600",
};

const TYPE_LABELS: Record<ActivityType, string> = {
  NOTE:    "Notitie",
  CALL:    "Telefoon",
  MEETING: "Meeting",
  EMAIL:   "E-mail",
  TASK:    "Taak",
};

const HAS_DUE: Set<ActivityType> = new Set(["TASK", "CALL", "MEETING"]);

function formatRelative(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dag${days === 1 ? "" : "en"} geleden`;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function formatDue(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(dueAt: Date | string | null, status: string) {
  if (!dueAt || status === "DONE") return false;
  return new Date(dueAt) < new Date();
}

interface Props {
  dealId: string;
  activities: Activity[];
}

export function ActivityLog({ dealId, activities }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActivityType>("NOTE");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completingNote, setCompletingNote] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Fout bij opslaan");
        return;
      }
      setTitle("");
      setNotes("");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function startMarkDone(activityId: string) {
    setCompletingId(activityId);
    setCompletingNote("");
  }

  async function confirmMarkDone(activityId: string) {
    setCompleting(activityId);
    try {
      await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DONE",
          notes: completingNote.trim() || undefined,
        }),
      });
      setCompletingId(null);
      setCompletingNote("");
      router.refresh();
    } finally {
      setCompleting(null);
    }
  }

  async function reopen(activityId: string) {
    setCompleting(activityId);
    try {
      await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      });
      router.refresh();
    } finally {
      setCompleting(null);
    }
  }

  const open_activities = activities.filter((a) => a.status !== "DONE");
  const done_activities = activities.filter((a) => a.status === "DONE");

  return (
    <div className="space-y-4">
      {/* Add activity form toggle */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm text-brand-blue hover:text-brand-blue font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Activiteit toevoegen
        </button>
      ) : (
        <form
          onSubmit={submit}
          className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Nieuwe activiteit</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Type selector */}
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(TYPE_LABELS) as ActivityType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
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

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel *"
            required
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Toelichting (optioneel)"
            rows={3}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none"
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-3 py-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
        </form>
      )}

      {/* Activity list */}
      {activities.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-10 text-center text-slate-400 text-sm">
          Nog geen activiteiten gelogd
        </div>
      ) : (
        <div className="space-y-2">
          {/* Open activities */}
          {open_activities.map((a) => {
            const overdue = isOverdue(a.dueAt, a.status);
            const showDue = HAS_DUE.has(a.type as ActivityType) && a.dueAt;
            return (
              <div
                key={a.id}
                className={`bg-white border rounded-lg p-4 ${overdue ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 p-1.5 rounded-full shrink-0 ${TYPE_COLORS[a.type as ActivityType]}`}
                  >
                    {TYPE_ICONS[a.type as ActivityType]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{a.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {showDue && (
                          <span
                            className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${
                              overdue
                                ? "bg-red-100 text-red-600"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {formatDue(a.dueAt!)}
                            {overdue && " · verlopen"}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {formatRelative(a.createdAt)}
                        </span>
                      </div>
                    </div>
                    {a.notes && (
                      <p className="mt-1 text-sm text-slate-500 whitespace-pre-line">{a.notes}</p>
                    )}
                    {completingId === a.id && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={completingNote}
                          onChange={(e) => setCompletingNote(e.target.value)}
                          placeholder="Afsluitende notitie (optioneel)…"
                          rows={2}
                          autoFocus
                          className="w-full text-sm border border-green-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => confirmMarkDone(a.id)}
                            disabled={completing === a.id}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {completing === a.id ? "Bezig…" : "Afgerond"}
                          </button>
                          <button
                            onClick={() => { setCompletingId(null); setCompletingNote(""); }}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Annuleren
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400">{a.createdByUser.name}</p>
                      {HAS_DUE.has(a.type as ActivityType) && completingId !== a.id && (
                        <button
                          onClick={() => startMarkDone(a.id)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-green-600 transition-colors"
                          title="Markeren als afgerond"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Markeer afgerond
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Done activities (collapsed feel) */}
          {done_activities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-4 mb-2">
                Afgerond ({done_activities.length})
              </p>
              <div className="space-y-2">
                {done_activities.map((a) => (
                  <div
                    key={a.id}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-4 opacity-70"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 rounded-full shrink-0 bg-green-100 text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-600 line-through">
                            {a.title}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400">
                              {formatRelative(a.createdAt)}
                            </span>
                          </div>
                        </div>
                        {a.notes && (
                          <p className="mt-1 text-sm text-slate-400 whitespace-pre-line">{a.notes}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-400">{a.createdByUser.name}</p>
                          <button
                            onClick={() => reopen(a.id)}
                            disabled={completing === a.id}
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
                          >
                            {completing === a.id ? "Bezig…" : "Heropenen"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
