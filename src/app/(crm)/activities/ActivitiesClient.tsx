"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare, Phone, Users, Mail, CheckSquare,
  Clock, CheckCircle2, AlertCircle, X,
} from "lucide-react";

type ActivityType = "NOTE" | "CALL" | "MEETING" | "EMAIL" | "TASK";

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  notes: string | null;
  status: string;
  dueAt: string | null;
  createdAt: string;
  createdByUser: { name: string };
  deal: { id: string; dealNumber: string; title: string } | null;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  NOTE:    <MessageSquare className="w-3.5 h-3.5" />,
  CALL:    <Phone className="w-3.5 h-3.5" />,
  MEETING: <Users className="w-3.5 h-3.5" />,
  EMAIL:   <Mail className="w-3.5 h-3.5" />,
  TASK:    <CheckSquare className="w-3.5 h-3.5" />,
};

const TYPE_COLORS: Record<string, string> = {
  NOTE:    "bg-slate-100 text-slate-600",
  CALL:    "bg-brand-blue-light text-brand-blue",
  MEETING: "bg-purple-100 text-purple-600",
  EMAIL:   "bg-indigo-100 text-indigo-600",
  TASK:    "bg-amber-100 text-amber-600",
};

const TYPE_LABELS: Record<string, string> = {
  NOTE: "Notitie", CALL: "Bellen", MEETING: "Meeting", EMAIL: "E-mail", TASK: "Taak",
};

const ALL_TYPES = ["TASK", "CALL", "MEETING", "EMAIL", "NOTE"] as const;
const HAS_DUE = new Set(["TASK", "CALL", "MEETING"]);

function formatDue(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Vandaag";
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function getGroup(a: ActivityItem, now: Date): "overdue" | "today" | "upcoming" | "noduedate" {
  if (!a.dueAt) return "noduedate";
  const due = new Date(a.dueAt);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (due < today) return "overdue";
  if (due < tomorrow) return "today";
  return "upcoming";
}

// ─── Activiteit kaart ─────────────────────────────────────────────────────────
interface ActivityCardProps {
  a: ActivityItem;
  completing: string | null;
  completingNote: string;
  completingId: string | null;
  onStartComplete: (id: string) => void;
  onConfirmComplete: (id: string, note: string) => void;
  onCancelComplete: () => void;
  onNoteChange: (v: string) => void;
  onReopen: (id: string) => void;
}

function ActivityCard({
  a, completing, completingNote, completingId,
  onStartComplete, onConfirmComplete, onCancelComplete, onNoteChange, onReopen,
}: ActivityCardProps) {
  const isDone = a.status === "DONE";
  const overdue = !isDone && a.dueAt && new Date(a.dueAt) < new Date();
  const isConfirming = completingId === a.id;

  return (
    <div className={`bg-white border rounded-xl p-4 transition-colors ${
      isDone ? "opacity-60 border-slate-200" : overdue ? "border-red-200" : "border-slate-200"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
          isDone ? "bg-green-100 text-green-600" : TYPE_COLORS[a.type] ?? "bg-slate-100 text-slate-500"
        }`}>
          {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : (TYPE_ICONS[a.type] ?? <MessageSquare className="w-3.5 h-3.5" />)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={`text-sm font-medium ${isDone ? "text-slate-500 line-through" : "text-slate-800"}`}>
                {a.title}
              </span>
              {a.deal && (
                <Link href={`/deals/${a.deal.id}/activities`} className="ml-2 text-xs text-brand-blue hover:underline font-mono">
                  {a.deal.dealNumber}
                </Link>
              )}
            </div>
            {a.dueAt && HAS_DUE.has(a.type) && !isDone && (
              <span className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${
                overdue ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
              }`}>
                <Clock className="w-3 h-3" />
                {formatDue(a.dueAt)}
              </span>
            )}
          </div>

          {a.notes && (
            <p className="mt-1 text-sm text-slate-500 whitespace-pre-line line-clamp-2">{a.notes}</p>
          )}

          {/* Inline afrond-formulier */}
          {isConfirming && (
            <div className="mt-3 space-y-2">
              <textarea
                value={completingNote}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="Afsluitende notitie (optioneel)…"
                rows={2}
                autoFocus
                className="w-full text-sm border border-green-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onConfirmComplete(a.id, completingNote)}
                  disabled={completing === a.id}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {completing === a.id ? "Bezig…" : "Afgerond"}
                </button>
                <button
                  onClick={onCancelComplete}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Annuleren
                </button>
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              {a.createdByUser.name} · {formatRelative(a.createdAt)}
              {a.deal && <span className="ml-1 text-slate-300">· {a.deal.title}</span>}
            </p>
            {HAS_DUE.has(a.type) && !isConfirming && (
              isDone ? (
                <button
                  onClick={() => onReopen(a.id)}
                  disabled={completing === a.id}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
                >
                  Heropenen
                </button>
              ) : (
                <button
                  onClick={() => onStartComplete(a.id)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-green-600 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Markeer afgerond
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Groepssectie ─────────────────────────────────────────────────────────────
interface GroupSectionProps {
  title: string;
  items: ActivityItem[];
  completing: string | null;
  completingId: string | null;
  completingNote: string;
  onStartComplete: (id: string) => void;
  onConfirmComplete: (id: string, note: string) => void;
  onCancelComplete: () => void;
  onNoteChange: (v: string) => void;
  onReopen: (id: string) => void;
  headerClass?: string;
  icon?: React.ReactNode;
}

function GroupSection(props: GroupSectionProps) {
  const { title, items, headerClass, icon, ...cardProps } = props;
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`flex items-center gap-2 mb-2 ${headerClass ?? ""}`}>
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-widest">{title}</h3>
        <span className="text-xs opacity-60">({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map((a) => (
          <ActivityCard key={a.id} a={a} {...cardProps} />
        ))}
      </div>
    </div>
  );
}

// ─── Hoofd component ──────────────────────────────────────────────────────────
export function ActivitiesClient({ activities }: { activities: ActivityItem[] }) {
  const router = useRouter();
  const [completing, setCompleting] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completingNote, setCompletingNote] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  function startComplete(id: string) {
    setCompletingId(id);
    setCompletingNote("");
  }

  function cancelComplete() {
    setCompletingId(null);
    setCompletingNote("");
  }

  async function confirmComplete(id: string, note: string) {
    setCompleting(id);
    try {
      await fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DONE",
          notes: note.trim() || undefined,
        }),
      });
      setCompletingId(null);
      setCompletingNote("");
      router.refresh();
    } finally {
      setCompleting(null);
    }
  }

  async function reopen(id: string) {
    setCompleting(id);
    try {
      await fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      });
      router.refresh();
    } finally {
      setCompleting(null);
    }
  }

  const now = new Date();

  const filtered = activities.filter((a) => {
    if (filterType && a.type !== filterType) return false;
    if (!showDone && a.status === "DONE") return false;
    return true;
  });

  const open     = filtered.filter((a) => a.status !== "DONE");
  const done     = filtered.filter((a) => a.status === "DONE");
  const overdue  = open.filter((a) => getGroup(a, now) === "overdue");
  const today    = open.filter((a) => getGroup(a, now) === "today");
  const upcoming = open.filter((a) => getGroup(a, now) === "upcoming");
  const noDate   = open.filter((a) => getGroup(a, now) === "noduedate");

  const cardProps = {
    completing,
    completingId,
    completingNote,
    onStartComplete: startComplete,
    onConfirmComplete: confirmComplete,
    onCancelComplete: cancelComplete,
    onNoteChange: setCompletingNote,
    onReopen: reopen,
  };

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              !filterType ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            Alles ({activities.filter((a) => a.status !== "DONE").length} open)
          </button>
          {ALL_TYPES.map((t) => {
            const count = activities.filter((a) => a.type === t && a.status !== "DONE").length;
            return (
              <button
                key={t}
                onClick={() => setFilterType(filterType === t ? null : t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  filterType === t ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {TYPE_ICONS[t]}
                {TYPE_LABELS[t]}
                {count > 0 && <span className="opacity-60 ml-0.5">{count}</span>}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowDone(!showDone)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            showDone ? "bg-green-50 border-green-200 text-green-700" : "border-slate-200 text-slate-500"
          }`}
        >
          {showDone ? "✓ Afgerond verbergen" : "Toon afgerond"}
        </button>
      </div>

      {/* Groepen */}
      <div className="space-y-6">
        <GroupSection title="Verlopen" items={overdue} {...cardProps}
          headerClass="text-red-600" icon={<AlertCircle className="w-3.5 h-3.5 text-red-500" />} />
        <GroupSection title="Vandaag" items={today} {...cardProps}
          headerClass="text-orange-600" icon={<Clock className="w-3.5 h-3.5 text-orange-500" />} />
        <GroupSection title="Aankomend" items={upcoming} {...cardProps}
          headerClass="text-slate-600" />
        <GroupSection title="Geen deadline" items={noDate} {...cardProps}
          headerClass="text-slate-500" />
        {showDone && <GroupSection title="Afgerond" items={done} {...cardProps}
          headerClass="text-slate-400" />}

        {filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center text-slate-400 text-sm">
            Geen activiteiten gevonden
          </div>
        )}
      </div>
    </div>
  );
}
