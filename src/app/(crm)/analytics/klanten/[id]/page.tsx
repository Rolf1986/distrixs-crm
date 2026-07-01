import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { CrmLinkPanel } from "@/components/analytics/CrmLinkPanel";
import {
  ArrowLeft,
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

export const dynamic = "force-dynamic";

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

async function getData(id: string) {
  const account = await prisma.webshopAccount.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, companyName: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!account) return null;

  const [sessions, totals, customersRaw, suggestionContact] = await Promise.all([
    prisma.analyticsSession.findMany({
      where: { visitor: { accountId: id } },
      include: { events: { orderBy: { occurredAt: "asc" } } },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    prisma.analyticsSession.aggregate({ where: { visitor: { accountId: id } }, _count: true }),
    prisma.customer.findMany({
      select: {
        id: true,
        companyName: true,
        customerNumber: true,
        contacts: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { companyName: "asc" },
    }),
    // Suggestie: zelfde e-mailadres bij een CRM-contactpersoon
    account.email && account.linkStatus !== "CONFIRMED"
      ? prisma.customerContact.findFirst({
          where: { email: { equals: account.email, mode: "insensitive" } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            customerId: true,
            customer: { select: { companyName: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  const customers = customersRaw.map((c) => ({
    id: c.id,
    label: c.companyName,
    sub: c.customerNumber,
    contacts: c.contacts.map((ct) => ({ id: ct.id, label: `${ct.firstName} ${ct.lastName}`.trim() })),
  }));

  const suggestion = suggestionContact
    ? {
        customerId: suggestionContact.customerId,
        customerLabel: suggestionContact.customer.companyName,
        contactId: suggestionContact.id,
        contactLabel: `${suggestionContact.firstName} ${suggestionContact.lastName}`.trim(),
      }
    : null;

  return { account, sessions, sessionCount: totals._count, customers, suggestion };
}

export default async function AnalyticsKlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  const { account, sessions, sessionCount, customers, suggestion } = data;

  const eventCount = sessions.reduce((s, ss) => s + ss.events.length, 0);
  const contactLabel = account.contact
    ? `${account.contact.firstName} ${account.contact.lastName}`.trim()
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-8 pt-8 pb-6">
        <Link
          href="/analytics/klanten"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Alle klanten
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          {account.displayName ?? `Klant #${account.wcUserId}`}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {account.email ?? "geen e-mail"} · WooCommerce-ID {account.wcUserId}
        </p>
      </div>

      <div className="px-8 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
        {/* Links: koppeling + kerncijfers */}
        <div className="lg:col-span-1 space-y-4">
          <CrmLinkPanel
            accountId={account.id}
            linkStatus={account.linkStatus}
            linkedCustomerLabel={account.customer?.companyName}
            linkedContactLabel={contactLabel}
            customers={customers}
            suggestion={suggestion}
          />

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Sessies</span>
              <span className="text-sm font-semibold text-slate-900">{sessionCount}</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Events (laatste 50 sessies)</span>
              <span className="text-sm font-semibold text-slate-900">{eventCount}</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Laatst gezien</span>
              <span className="text-sm text-slate-700">{formatDateTime(account.lastSeenAt)}</span>
            </div>
          </div>
        </div>

        {/* Rechts: chronologische tijdlijn */}
        <div className="lg:col-span-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Tijdlijn</h2>
          {sessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 px-8 py-12 text-center text-slate-400 text-sm">
              Nog geen sessies vastgelegd voor deze klant.
            </div>
          ) : (
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
                              {e.productSku && (
                                <span className="ml-1.5 font-mono text-xs text-slate-400">{e.productSku}</span>
                              )}
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
          )}
        </div>
      </div>
    </div>
  );
}
