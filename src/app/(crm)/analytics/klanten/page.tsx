import Link from "next/link";
import { RowLink } from "@/components/RowLink";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";
import { UserCheck, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  wc_user_id: number;
  email: string | null;
  display_name: string | null;
  link_status: "UNLINKED" | "SUGGESTED" | "CONFIRMED";
  last_seen_at: Date;
  company_name: string | null;
  sessions: bigint;
  events: bigint;
};

async function getAccounts() {
  return prisma.$queryRaw<Row[]>`
    SELECT a.id, a.wc_user_id, a.email, a.display_name, a.link_status, a.last_seen_at,
           c.company_name,
           count(DISTINCT s.id) AS sessions,
           count(DISTINCT e.id) AS events
    FROM webshop_accounts a
    LEFT JOIN customers c          ON c.id = a.customer_id
    LEFT JOIN analytics_visitors v ON v.account_id = a.id
    LEFT JOIN analytics_sessions s ON s.visitor_id = v.id
    LEFT JOIN analytics_events e   ON e.visitor_id = v.id
    WHERE a.excluded = false
    GROUP BY a.id, c.company_name
    ORDER BY a.last_seen_at DESC
    LIMIT 200`;
}

function LinkBadge({ status, company }: { status: Row["link_status"]; company: string | null }) {
  if (status === "CONFIRMED" && company) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
        {company}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs font-medium">
      Niet gekoppeld
    </span>
  );
}

export default async function AnalyticsKlantenPage() {
  const accounts = await getAccounts();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-8 pt-8 pb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Webshop-analytics</h1>
        <p className="text-sm text-slate-400 mt-0.5">Ingelogde klanten en hun activiteit</p>
      </div>
      <div className="px-8">
        <AnalyticsTabs />
      </div>

      <div className="px-8 py-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Klant</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">CRM-koppeling</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Sessies</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Events</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Laatst gezien</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Nog geen ingelogde klanten geregistreerd
                  </td>
                </tr>
              )}
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors relative">
                  <td className="px-5 py-3">
                    <RowLink href={`/analytics/klanten/${a.id}`} />
                    <p className="font-medium text-slate-800">{a.display_name ?? `Klant #${a.wc_user_id}`}</p>
                    {a.email && <p className="text-xs text-slate-400">{a.email}</p>}
                  </td>
                  <td className="px-5 py-3"><LinkBadge status={a.link_status} company={a.company_name} /></td>
                  <td className="px-5 py-3 text-right font-medium text-slate-900">{Number(a.sessions).toLocaleString("nl-NL")}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{Number(a.events).toLocaleString("nl-NL")}</td>
                  <td className="px-5 py-3 text-slate-500">{formatDateTime(a.last_seen_at)}</td>
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
