import { formatDateTime } from "@/lib/utils";
import {
  Eye,
  Package,
  ShoppingCart,
  Search,
  LogIn,
  MousePointerClick,
  Megaphone,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";

// Chronologische tijdlijn van sessies + events. Herbruikt door de klant- én
// de bezoeker-detailpagina, zodat beide exact dezelfde weergave tonen.

const EVENT_META: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  pageview: { icon: <Eye className="w-3.5 h-3.5" />, label: "Paginaweergave", cls: "bg-slate-100 text-slate-500" },
  product_view: { icon: <Package className="w-3.5 h-3.5" />, label: "Product bekeken", cls: "bg-brand-blue-light text-brand-blue" },
  add_to_cart: { icon: <ShoppingCart className="w-3.5 h-3.5" />, label: "In winkelwagen", cls: "bg-green-100 text-green-600" },
  search: { icon: <Search className="w-3.5 h-3.5" />, label: "Gezocht", cls: "bg-amber-100 text-amber-600" },
  login: { icon: <LogIn className="w-3.5 h-3.5" />, label: "Ingelogd", cls: "bg-indigo-100 text-indigo-600" },
  click: { icon: <MousePointerClick className="w-3.5 h-3.5" />, label: "Klik", cls: "bg-slate-100 text-slate-500" },
};

const DEVICE_ICON: Record<string, React.ReactNode> = {
  mobile: <Smartphone className="w-3.5 h-3.5" />,
  tablet: <Tablet className="w-3.5 h-3.5" />,
  desktop: <Monitor className="w-3.5 h-3.5" />,
};

const timeFmt = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });

export type TimelineEvent = {
  id: string;
  type: string;
  path: string | null;
  productSku: string | null;
  occurredAt: Date;
};

export type TimelineSession = {
  id: string;
  startedAt: Date;
  device: string | null;
  utmCampaign: string | null;
  utmSource: string | null;
  referrer: string | null;
  events: TimelineEvent[];
};

export function SessionTimeline({
  sessions,
  emptyText = "Nog geen sessies vastgelegd.",
}: {
  sessions: TimelineSession[];
  emptyText?: string;
}) {
  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 px-8 py-12 text-center text-slate-400 text-sm">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => (
        <div key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              {DEVICE_ICON[s.device ?? "desktop"] ?? <Monitor className="w-3.5 h-3.5" />}
              <span className="font-medium text-slate-800">{formatDateTime(s.startedAt)}</span>
              <span className="text-slate-400">· {s.events.length} events</span>
            </div>
            {s.utmCampaign ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue-light text-brand-blue px-2 py-0.5 text-xs font-medium">
                <Megaphone className="w-3 h-3" />
                {s.utmCampaign}
                {s.utmSource ? ` · ${s.utmSource}` : ""}
              </span>
            ) : s.referrer ? (
              <span className="text-xs text-slate-400 truncate max-w-[240px]">via {s.referrer}</span>
            ) : (
              <span className="text-xs text-slate-400">direct</span>
            )}
          </div>
          <ol className="divide-y divide-slate-50">
            {s.events.map((e) => {
              const meta = EVENT_META[e.type] ?? EVENT_META.click;
              return (
                <li key={e.id} className="px-5 py-2.5 flex items-center gap-3">
                  <div className={`p-1.5 rounded-full shrink-0 ${meta.cls}`}>{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">
                      {meta.label}
                      {e.productSku && <span className="ml-1.5 font-mono text-xs text-slate-400">{e.productSku}</span>}
                    </p>
                    {e.path && <p className="text-xs text-slate-400 truncate">{e.path}</p>}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{timeFmt.format(e.occurredAt)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
