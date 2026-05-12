import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  Activity,
  CreditCard,
  Trash2,
  RefreshCw,
  Info,
} from "lucide-react";

const ACTION_META: Record<
  string,
  { label: string; Icon: React.ElementType; color: string }
> = {
  "invoice.status_changed": {
    label: "Status gewijzigd",
    Icon: RefreshCw,
    color: "text-blue-500 bg-blue-50",
  },
  "payment.created": {
    label: "Betaling geregistreerd",
    Icon: CreditCard,
    color: "text-green-600 bg-green-50",
  },
  "payment.deleted": {
    label: "Betaling verwijderd",
    Icon: Trash2,
    color: "text-red-500 bg-red-50",
  },
};

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
      if (action === "payment.created" && "amount" in obj) {
        return `€ ${Number(obj.amount).toFixed(2)}`;
      }
      if (action === "payment.deleted" && "amount" in obj) {
        return obj.amount != null ? `€ ${Number(obj.amount).toFixed(2)}` : null;
      }
    }
    return String(parsed);
  } catch {
    return value;
  }
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function InvoiceAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { invoiceNumber: true },
  });
  if (!invoice) notFound();

  const logs = await prisma.auditLog.findMany({
    where: { entityType: "Invoice", entityId: id },
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl">
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Activity className="w-8 h-8 mb-3 opacity-40" />
          <p className="text-sm">Nog geen activiteit geregistreerd</p>
        </div>
      ) : (
        <ol className="relative border-l border-slate-200 ml-4 space-y-0">
          {logs.map((log, idx) => {
            const meta =
              ACTION_META[log.action] ?? {
                label: log.action,
                Icon: Info,
                color: "text-slate-500 bg-slate-100",
              };
            const Icon = meta.Icon;
            const oldVal = formatValue(log.action, log.oldValue ?? null);
            const newVal = formatValue(log.action, log.newValue ?? null);
            const isLast = idx === logs.length - 1;

            return (
              <li key={log.id} className={`ml-6 ${isLast ? "" : "pb-6"}`}>
                {/* Dot */}
                <span
                  className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white ${meta.color}`}
                >
                  <Icon className="w-3 h-3" />
                </span>

                <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-800">
                      {meta.label}
                    </p>
                    <time className="text-xs text-slate-400 whitespace-nowrap">
                      {formatTimestamp(log.createdAt)}
                    </time>
                  </div>

                  {log.user && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      door {log.user.name}
                    </p>
                  )}

                  {(oldVal || newVal) && (
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      {oldVal && (
                        <span className="bg-red-50 text-red-600 border border-red-100 rounded px-2 py-0.5">
                          {oldVal}
                        </span>
                      )}
                      {oldVal && newVal && (
                        <span className="text-slate-300">→</span>
                      )}
                      {newVal && (
                        <span className="bg-green-50 text-green-700 border border-green-100 rounded px-2 py-0.5">
                          {newVal}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
