import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Phone, CalendarDays, CheckSquare, MessageSquare, Mail, TrendingUp, AlertTriangle, Clock, Receipt, FileText } from "lucide-react";

async function getDashboardData() {
  const today = new Date();
  const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(today); endOfDay.setHours(23, 59, 59, 999);

  const [
    activeDeals, sentQuotes, openInvoices,
    recentDeals, upcomingInvoices,
    overdueActivities, todayActivities,
  ] = await Promise.all([
    prisma.deal.findMany({
      where: { status: { notIn: ["LOST", "WON"] } },
      include: {
        customer: { select: { companyName: true } },
        quotes: {
          where: { status: { not: "REJECTED" } },
          select: { total: true },
        },
      },
    }),
    prisma.quote.findMany({ where: { status: "SENT" }, select: { total: true } }),
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "CREDITED"] } },
      select: { openAmount: true, status: true, dueDate: true },
    }),
    prisma.deal.findMany({
      include: {
        customer: { select: { companyName: true } },
        quotes: {
          where: { status: { not: "REJECTED" } },
          select: { total: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "CREDITED"] } },
      include: { customer: { select: { companyName: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    // Verlopen activiteiten
    prisma.activity.findMany({
      where: { status: "OPEN", dueAt: { lt: startOfDay }, type: { in: ["TASK", "CALL", "MEETING"] } },
      include: {
        deal: { select: { id: true, dealNumber: true } },
        customer: { select: { id: true, companyName: true } },
        createdByUser: { select: { name: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 8,
    }),
    // Vandaag geplande activiteiten
    prisma.activity.findMany({
      where: { status: "OPEN", dueAt: { gte: startOfDay, lte: endOfDay } },
      include: {
        deal: { select: { id: true, dealNumber: true } },
        customer: { select: { id: true, companyName: true } },
        createdByUser: { select: { name: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
  ]);

  const pipelineValue = activeDeals.reduce((s, d) =>
    s + d.quotes.reduce((s, q) => s + Number(q.total), 0), 0);
  const openInvoiceAmount = openInvoices.reduce((s, i) => s + Number(i.openAmount), 0);
  const overdueInvoiceCount = openInvoices.filter((i) => i.dueDate && new Date(i.dueDate) < today).length;
  const sentQuotesTotal = sentQuotes.reduce((s, q) => s + Number(q.total), 0);

  return {
    activeDeals, recentDeals, upcomingInvoices,
    overdueActivities, todayActivities,
    pipelineValue,
    openInvoiceAmount, openInvoiceCount: openInvoices.length, overdueInvoiceCount,
    sentQuotesCount: sentQuotes.length, sentQuotesTotal,
  };
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  CALL:    <Phone className="w-3.5 h-3.5" />,
  MEETING: <CalendarDays className="w-3.5 h-3.5" />,
  TASK:    <CheckSquare className="w-3.5 h-3.5" />,
  NOTE:    <MessageSquare className="w-3.5 h-3.5" />,
  EMAIL:   <Mail className="w-3.5 h-3.5" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  CALL:    "bg-brand-blue-light text-brand-blue",
  MEETING: "bg-purple-100 text-purple-600",
  TASK:    "bg-amber-100 text-amber-600",
  NOTE:    "bg-slate-100 text-slate-500",
  EMAIL:   "bg-indigo-100 text-indigo-600",
};

export default async function DashboardPage() {
  const {
    activeDeals, recentDeals, upcomingInvoices,
    overdueActivities, todayActivities,
    pipelineValue, openInvoiceAmount, openInvoiceCount, overdueInvoiceCount,
    sentQuotesCount, sentQuotesTotal,
  } = await getDashboardData();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayName = new Intl.DateTimeFormat("nl-NL", { weekday: "long" }).format(new Date());
  const dateStr = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <h1 className="text-2xl font-semibold text-slate-900 capitalize">{dayName}</h1>
        <p className="text-sm text-slate-400 mt-0.5">{dateStr}</p>
      </div>

      {/* KPI row */}
      <div className="px-8 grid grid-cols-4 gap-4 mb-8">
        <Link
          href="/deals"
          className="relative overflow-hidden bg-gradient-to-br from-blue-50/70 to-white rounded-xl border border-slate-200 border-l-4 border-l-brand-blue px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pipeline</p>
            <span className="p-1.5 rounded-lg bg-brand-blue/10 text-brand-blue">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(pipelineValue)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{activeDeals.length} actieve deals</p>
        </Link>

        <Link
          href="/invoices"
          className={`relative overflow-hidden rounded-xl border border-slate-200 border-l-4 px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
            overdueInvoiceCount > 0
              ? "border-l-orange-500 bg-gradient-to-br from-orange-50/70 to-white"
              : "border-l-slate-300 bg-gradient-to-br from-slate-50/70 to-white"
          }`}
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Openstaand</p>
            <span className={`p-1.5 rounded-lg ${overdueInvoiceCount > 0 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-500"}`}>
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(openInvoiceAmount)}</p>
          <p className="text-xs mt-0.5">
            <span className="text-slate-400">{openInvoiceCount} facturen</span>
            {overdueInvoiceCount > 0 && (
              <span className="text-orange-600 font-medium"> · {overdueInvoiceCount} vervallen</span>
            )}
          </p>
        </Link>

        <Link
          href="/quotes"
          className="relative overflow-hidden bg-gradient-to-br from-indigo-50/70 to-white rounded-xl border border-slate-200 border-l-4 border-l-indigo-400 px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Offertes verzonden</p>
            <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{sentQuotesCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(sentQuotesTotal)} openstaand</p>
        </Link>

        <Link
          href="/activities"
          className={`relative overflow-hidden rounded-xl border border-slate-200 border-l-4 px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
            overdueActivities.length > 0
              ? "border-l-red-500 bg-gradient-to-br from-red-50/70 to-white"
              : "border-l-green-500 bg-gradient-to-br from-green-50/70 to-white"
          }`}
        >
          <div className="flex items-start justify-between">
            <p className={`text-xs font-semibold uppercase tracking-wide ${overdueActivities.length > 0 ? "text-red-500" : "text-slate-500"}`}>
              Verlopen taken
            </p>
            <span className={`p-1.5 rounded-lg ${overdueActivities.length > 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
              {overdueActivities.length > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
            </span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${overdueActivities.length > 0 ? "text-red-600" : "text-slate-900"}`}>
            {overdueActivities.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {overdueActivities.length === 0 ? "Alles up-to-date ✓" : "vereisen opvolging"}
          </p>
        </Link>
      </div>

      <div className="px-8 grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Vandaag — agenda */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                Vandaag
              </h2>
              <Link href="/activities" className="text-xs text-brand-blue hover:text-brand-blue">Alle →</Link>
            </div>
            {todayActivities.length === 0 && overdueActivities.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                <CheckSquare className="w-8 h-8 mx-auto mb-2 text-green-400" />
                Niets gepland voor vandaag
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {overdueActivities.slice(0, 3).map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3 bg-red-50/30">
                    <div className={`p-1.5 rounded-full shrink-0 ${ACTIVITY_COLORS[a.type] ?? "bg-slate-100 text-slate-500"}`}>
                      {ACTIVITY_ICONS[a.type] ?? <CheckSquare className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 font-medium truncate">{a.title}</p>
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        Verlopen
                        {a.deal && (
                          <Link href={`/deals/${a.deal.id}/activities`} className="ml-1 font-mono hover:underline text-slate-400">{a.deal.dealNumber}</Link>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                {todayActivities.map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                    <div className={`p-1.5 rounded-full shrink-0 ${ACTIVITY_COLORS[a.type] ?? "bg-slate-100 text-slate-500"}`}>
                      {ACTIVITY_ICONS[a.type] ?? <CheckSquare className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 font-medium truncate">{a.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {a.deal
                          ? <Link href={`/deals/${a.deal.id}/activities`} className="font-mono hover:text-brand-blue">{a.deal.dealNumber}</Link>
                          : a.customer
                          ? <Link href={`/customers/${a.customer.id}`} className="hover:text-brand-blue">{a.customer.companyName}</Link>
                          : a.createdByUser.name
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Vervallende facturen */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Vervallende facturen</h2>
              <Link href="/invoices" className="text-xs text-brand-blue hover:text-brand-blue">Alle →</Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Factuur</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Klant</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Vervaldatum</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Open</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {upcomingInvoices.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Geen openstaande facturen</td></tr>
                )}
                {upcomingInvoices.map((inv) => {
                  const isOverdue = inv.dueDate && new Date(inv.dueDate) < today;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors relative">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">
                        <Link href={`/invoices/${inv.id}/payments`} className="absolute inset-0" />
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{inv.customer.companyName}</td>
                      <td className={`px-5 py-3 font-medium text-sm ${isOverdue ? "text-red-600" : "text-slate-600"}`}>
                        {formatDate(inv.dueDate)}
                        {isOverdue && <span className="ml-1.5 text-xs font-normal text-red-400">(verlopen)</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">{formatCurrency(Number(inv.openAmount))}</td>
                      <td className="px-5 py-3"><StatusBadge status={inv.status} type="invoice" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recente deals */}
      <div className="px-8 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Recente deals</h2>
          <Link href="/deals" className="text-xs text-brand-blue hover:text-brand-blue">Alle deals →</Link>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Nummer</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Titel</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Klant</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Waarde</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentDeals.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nog geen deals</td></tr>
              )}
              {recentDeals.map((deal) => {
                const omzet = deal.quotes.reduce((s, q) => s + Number(q.total), 0);
                return (
                  <tr key={deal.id} className="hover:bg-slate-50 transition-colors relative">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">
                      <Link href={`/deals/${deal.id}/info`} className="absolute inset-0" />
                      {deal.dealNumber}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">{deal.title}</td>
                    <td className="px-5 py-3 text-slate-500">{deal.customer.companyName}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">{formatCurrency(omzet)}</td>
                    <td className="px-5 py-3"><StatusBadge status={deal.status} type="deal" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
