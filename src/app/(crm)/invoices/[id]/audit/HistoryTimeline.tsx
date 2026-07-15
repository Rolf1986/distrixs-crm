"use client";

import { useState } from "react";
import { CreditCard, Trash2, RefreshCw, Info, Mail, Bell, Eye, X, Loader2 } from "lucide-react";

export type HistoryItem =
  | {
      kind: "audit";
      id: string;
      action: string;
      at: string;
      user: string | null;
      oldValue: string | null;
      newValue: string | null;
    }
  | {
      kind: "email";
      id: string;
      emailKind: "INVOICE" | "REMINDER";
      at: string;
      to: string;
      subject: string;
    }
  | { kind: "reminder"; id: string; at: string; notes: string | null };

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verzonden",
  PARTIALLY_PAID: "Deels betaald",
  PAID: "Betaald",
  OVERDUE: "Verlopen",
  CREDITED: "Gecrediteerd",
};

function formatValue(action: string, value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (action === "invoice.status_changed" && typeof parsed === "string") {
      return STATUS_LABELS[parsed] ?? parsed;
    }
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      if ((action === "payment.created" || action === "payment.deleted") && "amount" in obj) {
        return obj.amount != null ? `€ ${Number(obj.amount).toFixed(2)}` : null;
      }
    }
    return String(parsed);
  } catch {
    return value;
  }
}

function fmt(at: string): string {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(at));
}

const AUDIT_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  "invoice.status_changed": { label: "Status gewijzigd", Icon: RefreshCw, color: "text-blue-500 bg-blue-50" },
  "payment.created": { label: "Betaling geregistreerd", Icon: CreditCard, color: "text-green-600 bg-green-50" },
  "payment.deleted": { label: "Betaling verwijderd", Icon: Trash2, color: "text-red-500 bg-red-50" },
};

export function HistoryTimeline({ invoiceId, items }: { invoiceId: string; items: HistoryItem[] }) {
  const [viewing, setViewing] = useState<{ subject: string; to: string; ccAddress: string | null; sentAt: string; bodyHtml: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function viewEmail(emailId: string) {
    setLoadingId(emailId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/emails/${emailId}`);
      if (res.ok) setViewing(await res.json());
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Info className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm">Nog geen activiteit geregistreerd</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <ol className="relative border-l border-slate-200 ml-4 space-y-0">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          let Icon: React.ElementType = Info;
          let color = "text-slate-500 bg-slate-100";
          let label = "";
          let node: React.ReactNode = null;

          if (item.kind === "email") {
            Icon = Mail;
            color = "text-brand-blue bg-blue-50";
            label = item.emailKind === "REMINDER" ? "Herinnering verstuurd" : "Factuur verstuurd";
            node = (
              <>
                <p className="text-xs text-slate-500 mt-0.5">
                  aan {item.to} · <span className="text-slate-400">{item.subject}</span>
                </p>
                <button
                  onClick={() => viewEmail(item.id)}
                  disabled={loadingId === item.id}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline disabled:opacity-50"
                >
                  {loadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  Bekijk mail
                </button>
              </>
            );
          } else if (item.kind === "reminder") {
            Icon = Bell;
            color = "text-orange-500 bg-orange-50";
            label = "Herinnering verstuurd";
            node = item.notes ? <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p> : null;
          } else {
            const meta = AUDIT_META[item.action] ?? { label: item.action, Icon: Info, color: "text-slate-500 bg-slate-100" };
            Icon = meta.Icon;
            color = meta.color;
            label = meta.label;
            const oldVal = formatValue(item.action, item.oldValue);
            const newVal = formatValue(item.action, item.newValue);
            node = (
              <>
                {item.user && <p className="text-xs text-slate-500 mt-0.5">door {item.user}</p>}
                {(oldVal || newVal) && (
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    {oldVal && <span className="bg-red-50 text-red-600 border border-red-100 rounded px-2 py-0.5">{oldVal}</span>}
                    {oldVal && newVal && <span className="text-slate-300">→</span>}
                    {newVal && <span className="bg-green-50 text-green-700 border border-green-100 rounded px-2 py-0.5">{newVal}</span>}
                  </div>
                )}
              </>
            );
          }

          return (
            <li key={`${item.kind}-${item.id}`} className={`ml-6 ${isLast ? "" : "pb-6"}`}>
              <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white ${color}`}>
                <Icon className="w-3 h-3" />
              </span>
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <time className="text-xs text-slate-400 whitespace-nowrap">{fmt(item.at)}</time>
                </div>
                {node}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mail-viewer */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{viewing.subject}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  aan {viewing.to}{viewing.ccAddress ? ` · cc ${viewing.ccAddress}` : ""} · {fmt(viewing.sentAt)}
                </p>
              </div>
              <button onClick={() => setViewing(null)} className="p-1.5 text-slate-400 hover:text-slate-700 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe
              sandbox=""
              srcDoc={viewing.bodyHtml}
              className="w-full flex-1 min-h-[50vh] bg-white"
              title="E-mailinhoud"
            />
          </div>
        </div>
      )}
    </div>
  );
}
