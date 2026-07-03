import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { CrmLinkPanel } from "@/components/analytics/CrmLinkPanel";
import { ExcludeAccountButton } from "@/components/analytics/ExcludeAccountButton";
import { SessionTimeline } from "@/components/analytics/SessionTimeline";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

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

          <ExcludeAccountButton accountId={account.id} excluded={account.excluded} />

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
          <SessionTimeline sessions={sessions} emptyText="Nog geen sessies vastgelegd voor deze klant." />
          {sessions.length >= 50 && (
            <p className="text-xs text-slate-400 mt-3">Laatste 50 sessies getoond.</p>
          )}
        </div>
      </div>
    </div>
  );
}
