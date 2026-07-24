import Link from "next/link";
import { RowLink } from "@/components/RowLink";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";
import { Users, ChevronRight, UserCheck, User } from "lucide-react";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  vid: string;
  last_seen_at: Date;
  display_name: string | null;
  email: string | null;
  company_name: string | null;
  identified: boolean;
  sessions: bigint;
  events: bigint;
};

async function getVisitors() {
  return prisma.$queryRaw<Row[]>`
    SELECT v.id, v.vid, v.last_seen_at,
           a.display_name, a.email, c.company_name,
           (v.account_id IS NOT NULL) AS identified,
           count(DISTINCT s.id) AS sessions,
           count(DISTINCT e.id) AS events
    FROM analytics_visitors v
    LEFT JOIN webshop_accounts a   ON a.id = v.account_id
    LEFT JOIN customers c          ON c.id = a.customer_id
    LEFT JOIN analytics_sessions s ON s.visitor_id = v.id
    LEFT JOIN analytics_events e   ON e.visitor_id = v.id
    GROUP BY v.id, a.display_name, a.email, c.company_name
    ORDER BY v.last_seen_at DESC
    LIMIT 200`;
}

export default async function AnalyticsBezoekersPage() {
  const visitors = await getVisitors();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-8 pt-8 pb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Webshop-analytics</h1>
        <p className="text-sm text-slate-400 mt-0.5">Alle bezoekers — klik door voor het volledige spoor</p>
      </div>
      <div className="px-8">
        <AnalyticsTabs />
      </div>

      <div className="px-8 py-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Bezoeker</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">CRM-klant</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Sessies</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Events</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Laatst gezien</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visitors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Nog geen bezoekers geregistreerd
                  </td>
                </tr>
              )}
              {visitors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors relative">
                  <td className="px-5 py-3">
                    <RowLink href={`/analytics/bezoekers/${v.id}`} />
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-1.5 rounded-full shrink-0 ${
                          v.identified ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {v.identified ? <UserCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        {v.identified ? (
                          <>
                            <p className="font-medium text-slate-800 truncate">{v.display_name ?? v.email ?? "Ingelogde klant"}</p>
                            {v.email && v.display_name && <p className="text-xs text-slate-400 truncate">{v.email}</p>}
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-slate-600">Anonieme bezoeker</p>
                            <p className="font-mono text-xs text-slate-400">{v.vid.slice(0, 8)}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {v.company_name ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
                        {v.company_name}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-900">{Number(v.sessions).toLocaleString("nl-NL")}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{Number(v.events).toLocaleString("nl-NL")}</td>
                  <td className="px-5 py-3 text-slate-500">{formatDateTime(v.last_seen_at)}</td>
                  <td className="px-5 py-3 text-slate-300"><ChevronRight className="w-4 h-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
