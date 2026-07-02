import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { SessionTimeline } from "@/components/analytics/SessionTimeline";
import { ArrowLeft, UserCheck, User, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

async function getData(id: string) {
  const visitor = await prisma.analyticsVisitor.findUnique({
    where: { id },
    include: {
      account: {
        include: {
          customer: { select: { id: true, companyName: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!visitor) return null;

  const sessions = await prisma.analyticsSession.findMany({
    where: { visitorId: id },
    include: { events: { orderBy: { occurredAt: "asc" } } },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  return { visitor, sessions };
}

export default async function AnalyticsBezoekerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  const { visitor, sessions } = data;

  const account = visitor.account;
  const identified = !!account;
  const eventCount = sessions.reduce((s, ss) => s + ss.events.length, 0);
  const name = account?.displayName ?? account?.email ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-8 pt-8 pb-6">
        <Link
          href="/analytics/bezoekers"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Alle bezoekers
        </Link>
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-full shrink-0 ${
              identified ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
            }`}
          >
            {identified ? <UserCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {identified ? name : "Anonieme bezoeker"}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {identified ? (
                <>
                  {account!.email ? `${account!.email} · ` : ""}WooCommerce-ID {account!.wcUserId}
                </>
              ) : (
                <>Bezoeker-id {visitor.vid.slice(0, 12)}…</>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
        {/* Links: kerncijfers + eventuele klantkoppeling */}
        <div className="lg:col-span-1 space-y-4">
          {identified && account && (
            <Link
              href={`/analytics/klanten/${account.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 transition-colors"
            >
              <div>
                <p className="text-xs text-slate-500">Ingelogde klant</p>
                <p className="text-sm font-medium text-slate-800">{name}</p>
                {account.customer && (
                  <p className="text-xs text-slate-400">{account.customer.companyName}</p>
                )}
              </div>
              <ExternalLink className="w-4 h-4 text-slate-300" />
            </Link>
          )}

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Sessies</span>
              <span className="text-sm font-semibold text-slate-900">{sessions.length}</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Events</span>
              <span className="text-sm font-semibold text-slate-900">{eventCount}</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Eerste bezoek</span>
              <span className="text-sm text-slate-700">{formatDateTime(visitor.firstSeenAt)}</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Laatst gezien</span>
              <span className="text-sm text-slate-700">{formatDateTime(visitor.lastSeenAt)}</span>
            </div>
          </div>
        </div>

        {/* Rechts: volledige tijdlijn */}
        <div className="lg:col-span-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Volledige tijdlijn</h2>
          <SessionTimeline sessions={sessions} emptyText="Nog geen sessies vastgelegd voor deze bezoeker." />
          {sessions.length >= 100 && (
            <p className="text-xs text-slate-400 mt-3">Laatste 100 sessies getoond.</p>
          )}
        </div>
      </div>
    </div>
  );
}
