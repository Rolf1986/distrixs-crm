import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── helpers ──────────────────────────────────────────────────────────────────

function startOfMonth(y: number, m: number) {
  return new Date(y, m, 1);
}
function endOfMonth(y: number, m: number) {
  return new Date(y, m + 1, 0, 23, 59, 59, 999);
}
function startOfQuarter(y: number, q: number) {
  return new Date(y, (q - 1) * 3, 1);
}
function endOfQuarter(y: number, q: number) {
  return new Date(y, q * 3, 0, 23, 59, 59, 999);
}

const REVENUE_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;

// ─── data fetching ─────────────────────────────────────────────────────────────

async function getReportData() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  // determine current quarter (1-4)
  const cq = Math.floor(m / 3) + 1;
  // previous quarter
  const pqYear = cq === 1 ? y - 1 : y;
  const pq = cq === 1 ? 4 : cq - 1;

  const [
    thisMonthAgg,
    lastMonthAgg,
    thisQuarterAgg,
    lastQuarterAgg,
    thisYearAgg,
    debiteurenRaw,
    invoicesThisYear,
    supplierInvoicesOpen,
    paidInvoicesWithPayments,
    topCustomersRaw,
  ] = await Promise.all([
    // A. this month
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        status: { in: [...REVENUE_STATUSES] },
        invoiceDate: { gte: startOfMonth(y, m), lte: endOfMonth(y, m) },
      },
    }),
    // A. last month
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        status: { in: [...REVENUE_STATUSES] },
        invoiceDate: {
          gte: startOfMonth(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1),
          lte: endOfMonth(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1),
        },
      },
    }),
    // A. this quarter
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        status: { in: [...REVENUE_STATUSES] },
        invoiceDate: { gte: startOfQuarter(y, cq), lte: endOfQuarter(y, cq) },
      },
    }),
    // A. last quarter
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        status: { in: [...REVENUE_STATUSES] },
        invoiceDate: { gte: startOfQuarter(pqYear, pq), lte: endOfQuarter(pqYear, pq) },
      },
    }),
    // A. this year total
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        status: { in: [...REVENUE_STATUSES] },
        invoiceDate: { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59, 999) },
      },
    }),
    // B. debiteuren — openAmount > 0, not PAID/CREDITED
    prisma.invoice.findMany({
      where: {
        openAmount: { gt: 0 },
        status: { notIn: ["PAID", "CREDITED"] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        total: true,
        openAmount: true,
        customer: { select: { companyName: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    // C. BTW – all invoices this calendar year with vatAmount
    prisma.invoice.findMany({
      where: {
        status: { in: [...REVENUE_STATUSES] },
        invoiceDate: { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59, 999) },
      },
      select: { invoiceDate: true, subtotal: true, vatAmount: true, total: true },
    }),
    // D. openstaande inkoopfacturen
    prisma.supplierInvoice.findMany({
      where: { openAmount: { gt: 0 } },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        openAmount: true,
        supplier: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    // E. DSO — paid invoices with payments
    prisma.invoice.findMany({
      where: { status: "PAID", payments: { some: {} } },
      select: {
        id: true,
        invoiceDate: true,
        customerId: true,
        customer: { select: { companyName: true } },
        payments: { select: { paymentDate: true } },
      },
    }),
    // F. Top klanten — total invoiced per customer
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: { status: { notIn: ["CREDITED"] } },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    }),
  ]);

  // A. omzet overzicht
  const omzet = {
    thisMonth: Number(thisMonthAgg._sum.total ?? 0),
    lastMonth: Number(lastMonthAgg._sum.total ?? 0),
    thisQuarter: Number(thisQuarterAgg._sum.total ?? 0),
    lastQuarter: Number(lastQuarterAgg._sum.total ?? 0),
    thisYear: Number(thisYearAgg._sum.total ?? 0),
  };

  // B. debiteuren
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const debiteuren = debiteurenRaw.map((inv) => {
    const due = new Date(inv.dueDate);
    due.setHours(0, 0, 0, 0);
    const daysOverdue = due < today ? Math.ceil((today.getTime() - due.getTime()) / 86400000) : 0;
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customer: inv.customer.companyName,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      total: Number(inv.total),
      openAmount: Number(inv.openAmount),
      daysOverdue,
      isOverdue: due < today,
      isDueSoon: due >= today && due <= in7,
    };
  });

  // C. BTW per kwartaal
  type QData = { subtotal: number; vatAmount: number; total: number };
  const quarters: Record<number, QData> = { 1: { subtotal: 0, vatAmount: 0, total: 0 }, 2: { subtotal: 0, vatAmount: 0, total: 0 }, 3: { subtotal: 0, vatAmount: 0, total: 0 }, 4: { subtotal: 0, vatAmount: 0, total: 0 } };
  for (const inv of invoicesThisYear) {
    const q = Math.floor(new Date(inv.invoiceDate).getMonth() / 3) + 1;
    quarters[q].subtotal += Number(inv.subtotal);
    quarters[q].vatAmount += Number(inv.vatAmount);
    quarters[q].total += Number(inv.total);
  }
  const btwYearTotal: QData = { subtotal: 0, vatAmount: 0, total: 0 };
  for (const q of Object.values(quarters)) {
    btwYearTotal.subtotal += q.subtotal;
    btwYearTotal.vatAmount += q.vatAmount;
    btwYearTotal.total += q.total;
  }

  // D. inkoopfacturen
  const inkoop = supplierInvoicesOpen.map((si) => ({
    id: si.id,
    invoiceNumber: si.invoiceNumber,
    supplier: si.supplier.name,
    invoiceDate: si.invoiceDate,
    dueDate: si.dueDate,
    openAmount: Number(si.openAmount),
  }));
  const inkoopTotal = inkoop.reduce((s, i) => s + i.openAmount, 0);

  // E. DSO per klant
  type DsoEntry = { customerId: string; customerName: string; dsoSum: number; count: number };
  const dsoMap = new Map<string, DsoEntry>();
  for (const inv of paidInvoicesWithPayments) {
    const latestPayment = inv.payments.reduce(
      (max, p) => (p.paymentDate > max ? p.paymentDate : max),
      inv.payments[0].paymentDate
    );
    const days = Math.round((latestPayment.getTime() - inv.invoiceDate.getTime()) / 86400000);
    const existing = dsoMap.get(inv.customerId);
    if (existing) {
      existing.dsoSum += days;
      existing.count += 1;
    } else {
      dsoMap.set(inv.customerId, {
        customerId: inv.customerId,
        customerName: inv.customer.companyName,
        dsoSum: days,
        count: 1,
      });
    }
  }
  const dsoEntries = Array.from(dsoMap.values()).map((e) => ({ ...e, avgDso: Math.round(e.dsoSum / e.count) }));
  const avgDsoGlobal = dsoEntries.length > 0
    ? Math.round(dsoEntries.reduce((s, e) => s + e.avgDso, 0) / dsoEntries.length)
    : null;
  const bestDso = dsoEntries.length > 0 ? dsoEntries.reduce((a, b) => (a.avgDso <= b.avgDso ? a : b)) : null;
  const worstDso = dsoEntries.length > 0 ? dsoEntries.reduce((a, b) => (a.avgDso >= b.avgDso ? a : b)) : null;

  // F. Top klanten: load customer names for groupBy results
  const topCustomerIds = topCustomersRaw.map((r) => r.customerId);
  const topCustomerNames = await prisma.customer.findMany({
    where: { id: { in: topCustomerIds } },
    select: { id: true, companyName: true },
  });
  const nameMap = new Map(topCustomerNames.map((c) => [c.id, c.companyName]));
  const topCustomers = topCustomersRaw.map((r) => {
    const dsoEntry = dsoMap.get(r.customerId);
    return {
      customerId: r.customerId,
      customerName: nameMap.get(r.customerId) ?? r.customerId,
      invoiceCount: r._count.id,
      totalInvoiced: Number(r._sum.total ?? 0),
      avgDso: dsoEntry ? Math.round(dsoEntry.dsoSum / dsoEntry.count) : null,
    };
  });

  return { omzet, debiteuren, quarters, btwYearTotal, inkoop, inkoopTotal, year: y, currentQuarter: cq, avgDsoGlobal, bestDso, worstDso, topCustomers };
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default async function ReportsPage() {
  const { omzet, debiteuren, quarters, btwYearTotal, inkoop, inkoopTotal, year, currentQuarter, avgDsoGlobal, bestDso, worstDso, topCustomers } =
    await getReportData();

  const omzetChange = (base: number, current: number) => {
    if (base === 0) return null;
    const pct = ((current - base) / base) * 100;
    return pct;
  };
  const monthDelta = omzetChange(omzet.lastMonth, omzet.thisMonth);
  const quarterDelta = omzetChange(omzet.lastQuarter, omzet.thisQuarter);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">Rapportages</h1>
        <p className="text-sm text-slate-500 mt-1">Financieel overzicht · {year}</p>
      </div>

      <div className="px-8 py-6 space-y-8">
        {/* ── A. Omzet overzicht ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Omzet overzicht</h2>
          <div className="grid grid-cols-5 gap-4">
            {[
              {
                label: "Deze maand",
                value: formatCurrency(omzet.thisMonth),
                sub: omzet.lastMonth > 0
                  ? `Vorige maand: ${formatCurrency(omzet.lastMonth)}`
                  : "Vorige maand: —",
                delta: monthDelta,
              },
              {
                label: "Vorige maand",
                value: formatCurrency(omzet.lastMonth),
                sub: null,
                delta: null,
              },
              {
                label: `Q${currentQuarter} (huidig)`,
                value: formatCurrency(omzet.thisQuarter),
                sub: `Vorig kwartaal: ${formatCurrency(omzet.lastQuarter)}`,
                delta: quarterDelta,
              },
              {
                label: `Q${currentQuarter === 1 ? 4 : currentQuarter - 1} (vorig)`,
                value: formatCurrency(omzet.lastQuarter),
                sub: null,
                delta: null,
              },
              {
                label: `${year} totaal`,
                value: formatCurrency(omzet.thisYear),
                sub: "Status: verzonden t/m betaald",
                delta: null,
              },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</p>
                {kpi.delta !== null && (
                  <p className={`text-xs font-medium mt-0.5 ${kpi.delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {kpi.delta >= 0 ? "+" : ""}{kpi.delta!.toFixed(1)}% t.o.v. vorige periode
                  </p>
                )}
                {kpi.sub && (
                  <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── B. Debiteurenlijst ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Debiteurenlijst
            <span className="ml-2 text-xs font-normal text-slate-400">
              {debiteuren.length} openstaande {debiteuren.length === 1 ? "factuur" : "facturen"}
            </span>
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {debiteuren.length === 0 ? (
              <p className="px-6 py-10 text-sm text-slate-400 text-center">Geen openstaande facturen</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Klant</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Factuurnr</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Datum</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Vervaldatum</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Totaal</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Openstaand</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Dagen over tijd</th>
                  </tr>
                </thead>
                <tbody>
                  {debiteuren.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`border-b border-slate-100 last:border-0 ${
                        inv.isOverdue
                          ? "bg-red-50"
                          : inv.isDueSoon
                          ? "bg-orange-50"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-800 font-medium truncate max-w-[180px]">
                        {inv.customer}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          inv.isOverdue
                            ? "text-red-600"
                            : inv.isDueSoon
                            ? "text-orange-500"
                            : "text-slate-600"
                        }`}
                      >
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(inv.openAmount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.daysOverdue > 0 ? (
                          <span className="text-red-600 font-semibold">{inv.daysOverdue} dgn</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-600">Totaal openstaand</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(debiteuren.reduce((s, i) => s + i.openAmount, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* ── C. BTW-overzicht ────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">BTW-overzicht {year}</h2>
            <div className="flex items-center gap-2">
              {([1, 2, 3, 4] as const).map((q) => (
                <a
                  key={q}
                  href={`/api/reports/btw-export?year=${year}&quarter=${q}`}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    q === currentQuarter
                      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  CSV Q{q}
                </a>
              ))}
              <a
                href={`/api/reports/btw-export?year=${year}`}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                CSV heel jaar
              </a>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Kwartaal</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Subtotaal (excl. BTW)</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">BTW-bedrag</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Totaal (incl. BTW)</th>
                </tr>
              </thead>
              <tbody>
                {([1, 2, 3, 4] as const).map((q) => (
                  <tr
                    key={q}
                    className={`border-b border-slate-100 last:border-0 ${
                      q === currentQuarter ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-700">
                      Q{q} {year}
                      {q === currentQuarter && (
                        <span className="ml-2 text-xs text-blue-500 font-normal">huidig</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatCurrency(quarters[q].subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatCurrency(quarters[q].vatAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(quarters[q].total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-4 py-3 text-xs font-bold text-slate-700">Jaar {year}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {formatCurrency(btwYearTotal.subtotal)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {formatCurrency(btwYearTotal.vatAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {formatCurrency(btwYearTotal.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ── D. Openstaande inkoopfacturen ───────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Openstaande inkoopfacturen
            <span className="ml-2 text-xs font-normal text-slate-400">
              {inkoop.length} {inkoop.length === 1 ? "factuur" : "facturen"}
            </span>
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {inkoop.length === 0 ? (
              <p className="px-6 py-10 text-sm text-slate-400 text-center">Geen openstaande inkoopfacturen</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Leverancier</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Factuurnr</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Datum</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Vervaldatum</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Openstaand</th>
                  </tr>
                </thead>
                <tbody>
                  {inkoop.map((si) => {
                    const due = new Date(si.dueDate);
                    due.setHours(0, 0, 0, 0);
                    const today2 = new Date();
                    today2.setHours(0, 0, 0, 0);
                    const isOverdue = due < today2;
                    return (
                      <tr key={si.id} className={`border-b border-slate-100 last:border-0 ${isOverdue ? "bg-red-50" : ""}`}>
                        <td className="px-4 py-3 text-slate-800 font-medium">{si.supplier}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{si.invoiceNumber}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(si.invoiceDate)}</td>
                        <td className={`px-4 py-3 font-medium ${isOverdue ? "text-red-600" : "text-slate-600"}`}>
                          {formatDate(si.dueDate)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(si.openAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-600">Totaal openstaand</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(inkoopTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* ── E. Debiteurendagen (DSO) ────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Debiteurendagen (DSO)</h2>
          {avgDsoGlobal === null ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-400 text-center">
              Nog geen betaalde facturen met betalingsgegevens
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 font-medium">Gemiddelde DSO</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{avgDsoGlobal} dgn</p>
                <p className="text-xs text-slate-400 mt-0.5">Gem. betaaldag na factuurdatum</p>
              </div>
              {bestDso && (
                <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                  <p className="text-xs text-green-600 font-medium">Beste betaler</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 truncate">{bestDso.customerName}</p>
                  <p className="text-xs text-green-600 mt-0.5">gem. {bestDso.avgDso} dagen</p>
                </div>
              )}
              {worstDso && (
                <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
                  <p className="text-xs text-orange-600 font-medium">Langzaamste betaler</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 truncate">{worstDso.customerName}</p>
                  <p className="text-xs text-orange-600 mt-0.5">gem. {worstDso.avgDso} dagen</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── F. Top klanten (rendabiliteit) ─────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Top klanten
            <span className="ml-2 text-xs font-normal text-slate-400">op basis van gefactureerd bedrag</span>
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {topCustomers.length === 0 ? (
              <p className="px-6 py-10 text-sm text-slate-400 text-center">Nog geen factuurdata beschikbaar</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">#</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Klant</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Facturen</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Totaal gefactureerd</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Gem. betaaltermijn</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, i) => (
                    <tr key={c.customerId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400 text-xs font-medium">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.customerName}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{c.invoiceCount}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(c.totalInvoiced)}</td>
                      <td className="px-4 py-3 text-right">
                        {c.avgDso != null ? (
                          <span className={c.avgDso > 45 ? "text-orange-600 font-medium" : "text-slate-600"}>
                            {c.avgDso} dgn
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
