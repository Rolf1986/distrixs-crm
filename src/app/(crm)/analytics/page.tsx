import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SessionsBarChart, type SessionsPoint } from "@/components/analytics/SessionsBarChart";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";
import { FunnelBar } from "@/components/analytics/FunnelBar";
import { Users, Eye, MousePointerClick, UserCheck, Megaphone, Filter, Repeat, Package, ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic"; // altijd live cijfers

const RANGES = [7, 30, 90] as const;

function startOfRange(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dayLabel = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "numeric" });

async function getData(days: number) {
  const from = startOfRange(days);

  const [sessions, pageviews, visitors, accounts, perDayRaw, campaignsRaw, funnelRaw, returningRaw, topProductsRaw] =
    await Promise.all([
    prisma.analyticsSession.count({ where: { startedAt: { gte: from } } }),
    prisma.analyticsEvent.count({ where: { type: "pageview", occurredAt: { gte: from } } }),
    prisma.analyticsVisitor.count({ where: { sessions: { some: { startedAt: { gte: from } } } } }),
    prisma.webshopAccount.count({ where: { lastSeenAt: { gte: from } } }),
    prisma.$queryRaw<Array<{ day: Date; sessions: bigint; campaign_sessions: bigint }>>`
      SELECT date_trunc('day', started_at) AS day,
             count(*) AS sessions,
             count(*) FILTER (WHERE utm_campaign IS NOT NULL) AS campaign_sessions
      FROM analytics_sessions
      WHERE started_at >= ${from}
      GROUP BY 1
      ORDER BY 1`,
    prisma.$queryRaw<
      Array<{ campaign: string; source: string; medium: string; sessions: bigint; visitors: bigint; interactions: bigint }>
    >`
      SELECT coalesce(s.utm_campaign, '(geen campagne)') AS campaign,
             coalesce(s.utm_source, '(direct)')          AS source,
             coalesce(s.utm_medium, '')                  AS medium,
             count(DISTINCT s.id)                         AS sessions,
             count(DISTINCT s.visitor_id)                 AS visitors,
             count(e.id) FILTER (WHERE e.type <> 'pageview') AS interactions
      FROM analytics_sessions s
      LEFT JOIN analytics_events e ON e.session_id = s.id
      WHERE s.started_at >= ${from}
      GROUP BY 1, 2, 3
      ORDER BY sessions DESC
      LIMIT 50`,
    // Funnel: sessies → bekeek product → legde in winkelwagen
    prisma.$queryRaw<Array<{ sessions: bigint; product_view: bigint; add_to_cart: bigint }>>`
      SELECT count(DISTINCT s.id)                                       AS sessions,
             count(DISTINCT s.id) FILTER (WHERE e.type = 'product_view') AS product_view,
             count(DISTINCT s.id) FILTER (WHERE e.type = 'add_to_cart')  AS add_to_cart
      FROM analytics_sessions s
      LEFT JOIN analytics_events e ON e.session_id = s.id
      WHERE s.started_at >= ${from}`,
    // Nieuwe vs terugkerende bezoekers (op aantal sessies in de periode)
    prisma.$queryRaw<Array<{ new_visitors: bigint; returning_visitors: bigint }>>`
      SELECT count(*) FILTER (WHERE cnt = 1) AS new_visitors,
             count(*) FILTER (WHERE cnt > 1) AS returning_visitors
      FROM (
        SELECT visitor_id, count(*) AS cnt
        FROM analytics_sessions
        WHERE started_at >= ${from}
        GROUP BY visitor_id
      ) t`,
    // Top-producten (meest bekeken + in winkelwagen), verrijkt met CRM-producttitel
    prisma.$queryRaw<
      Array<{ product_sku: string; product_title: string | null; views: bigint; carts: bigint; visitors: bigint }>
    >`
      SELECT e.product_sku,
             p.title AS product_title,
             count(*) FILTER (WHERE e.type = 'product_view') AS views,
             count(*) FILTER (WHERE e.type = 'add_to_cart')  AS carts,
             count(DISTINCT e.visitor_id)                    AS visitors
      FROM analytics_events e
      LEFT JOIN products p ON p.sku = e.product_sku
      WHERE e.occurred_at >= ${from} AND e.product_sku IS NOT NULL
      GROUP BY e.product_sku, p.title
      ORDER BY views DESC, carts DESC
      LIMIT 15`,
  ]);

  // Continue dagreeks opbouwen (ook lege dagen tonen).
  const byDay = new Map<string, { sessions: number; campaignSessions: number }>();
  for (const r of perDayRaw) {
    byDay.set(isoDay(new Date(r.day)), {
      sessions: Number(r.sessions),
      campaignSessions: Number(r.campaign_sessions),
    });
  }
  const series: SessionsPoint[] = [];
  const cursor = new Date(from);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (cursor <= today) {
    const key = isoDay(cursor);
    const hit = byDay.get(key);
    series.push({
      day: key,
      label: dayLabel.format(cursor),
      sessions: hit?.sessions ?? 0,
      campaignSessions: hit?.campaignSessions ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const campaignSessions = series.reduce((s, d) => s + d.campaignSessions, 0);

  const campaigns = campaignsRaw.map((r) => ({
    campaign: r.campaign,
    source: r.source,
    medium: r.medium,
    sessions: Number(r.sessions),
    visitors: Number(r.visitors),
    interactions: Number(r.interactions),
  }));

  const f = funnelRaw[0];
  const funnel = [
    { label: "Sessies", value: Number(f?.sessions ?? 0) },
    { label: "Product bekeken", value: Number(f?.product_view ?? 0) },
    { label: "In winkelwagen", value: Number(f?.add_to_cart ?? 0) },
  ];

  const ret = returningRaw[0];
  const returning = { new: Number(ret?.new_visitors ?? 0), returning: Number(ret?.returning_visitors ?? 0) };

  const topProducts = topProductsRaw.map((r) => ({
    sku: r.product_sku,
    title: r.product_title,
    views: Number(r.views),
    carts: Number(r.carts),
    visitors: Number(r.visitors),
  }));

  return { sessions, pageviews, visitors, accounts, campaignSessions, series, campaigns, funnel, returning, topProducts };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = RANGES.includes(Number(daysParam) as (typeof RANGES)[number]) ? Number(daysParam) : 30;

  const { sessions, pageviews, visitors, accounts, campaignSessions, series, campaigns, funnel, returning, topProducts } =
    await getData(days);

  const totalVisitors = returning.new + returning.returning;
  const returningShare = totalVisitors > 0 ? Math.round((returning.returning / totalVisitors) * 100) : 0;

  const campaignShare = sessions > 0 ? Math.round((campaignSessions / sessions) * 100) : 0;
  const hasData = sessions > 0;

  const kpis = [
    { label: "Bezoekers", value: visitors, icon: Users, sub: "unieke bezoekers" },
    { label: "Sessies", value: sessions, icon: MousePointerClick, sub: `${campaignShare}% via campagne` },
    { label: "Paginaweergaven", value: pageviews, icon: Eye, sub: "totaal bekeken" },
    { label: "Ingelogde klanten", value: accounts, icon: UserCheck, sub: "actief in periode" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header + periode-selector */}
      <div className="px-8 pt-8 pb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Webshop-analytics</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gedrag op distrixs.nl · laatste {days} dagen</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/analytics?days=${r}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                r === days ? "text-white" : "text-slate-500 hover:text-slate-800"
              }`}
              style={r === days ? { backgroundColor: "#0170B9" } : undefined}
            >
              {r}d
            </Link>
          ))}
        </div>
      </div>

      <div className="px-8 mb-6">
        <AnalyticsTabs />
      </div>

      {/* KPI-rij */}
      <div className="px-8 grid grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" /> {k.label}
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{k.value.toLocaleString("nl-NL")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {!hasData ? (
        <div className="px-8">
          <div className="bg-white rounded-xl border border-slate-200 px-8 py-16 text-center">
            <MousePointerClick className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-700 font-medium">Nog geen gedragsdata</p>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Zodra het tracking-snippet live staat op distrixs.nl en bezoekers consent geven,
              verschijnen hier de sessies, campagnes en klantactiviteit.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Sessies per dag */}
          <div className="px-8 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Sessies per dag</h2>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: "#0170B9" }} />
                    Via campagne
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block bg-slate-300" />
                    Overig
                  </span>
                </div>
              </div>
              <div className="px-4 py-4">
                <SessionsBarChart data={series} />
              </div>
            </div>
          </div>

          {/* Funnel + terugkerende bezoekers */}
          <div className="px-8 mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" /> Conversie-funnel
                </h2>
              </div>
              <div className="px-5 py-5">
                <FunnelBar steps={funnel} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-slate-400" /> Terugkerende bezoekers
                </h2>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">{returningShare}%</span>
                  <span className="text-sm text-slate-400">komt terug</span>
                </div>
                <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${returningShare}%`, backgroundColor: "#0170B9" }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Terugkerend <span className="font-semibold text-slate-800">{returning.returning.toLocaleString("nl-NL")}</span>
                  </span>
                  <span className="text-slate-500">
                    Nieuw <span className="font-semibold text-slate-800">{returning.new.toLocaleString("nl-NL")}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Campagne-uitsplitsing */}
          <div className="px-8 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5" /> Herkomst &amp; campagnes
              </h2>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Campagne</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Bron / medium</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Sessies</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Bezoekers</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Interacties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {campaigns.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800">{c.campaign}</td>
                      <td className="px-5 py-3 text-slate-500">
                        {c.source}
                        {c.medium ? <span className="text-slate-400"> / {c.medium}</span> : null}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">{c.sessions.toLocaleString("nl-NL")}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{c.visitors.toLocaleString("nl-NL")}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{c.interactions.toLocaleString("nl-NL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top-producten */}
          <div className="px-8 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Top-producten
              </h2>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Product</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Weergaven</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">In winkelwagen</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Bezoekers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {topProducts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-slate-400">Nog geen productweergaven</td>
                    </tr>
                  )}
                  {topProducts.map((p) => (
                    <tr key={p.sku} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{p.title ?? p.sku}</p>
                        {p.title && <p className="font-mono text-xs text-slate-400">{p.sku}</p>}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">{p.views.toLocaleString("nl-NL")}</td>
                      <td className="px-5 py-3 text-right text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <ShoppingCart className="w-3.5 h-3.5 text-slate-300" />
                          {p.carts.toLocaleString("nl-NL")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">{p.visitors.toLocaleString("nl-NL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
