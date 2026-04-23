import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { TabNav } from "@/components/TabNav";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight, FileText, Receipt, ShoppingCart } from "lucide-react";

async function getDeal(id: string) {
  return prisma.deal.findUnique({
    where: { id },
    include: {
      customer: true,
      primaryContact: true,
      lines: { select: { netLineTotal: true, expectedMarginTotal: true } },
      _count: { select: { quotes: true, invoices: true, purchaseOrders: true } },
    },
  });
}

export default async function DealLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  const omzet = deal.lines.reduce((s, l) => s + Number(l.netLineTotal), 0);
  const marge = deal.lines.reduce((s, l) => s + Number(l.expectedMarginTotal), 0);
  const margePct = omzet > 0 ? (marge / omzet) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/deals" className="hover:text-slate-600 transition-colors">Deals</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-600 font-medium">{deal.dealNumber}</span>
      </div>

      {/* Header */}
      <div className="px-8 pt-3 pb-5 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{deal.title}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-sm text-slate-500">{deal.customer.companyName}</span>
              {deal.primaryContact && (
                <span className="text-sm text-slate-400">
                  · {deal.primaryContact.firstName} {deal.primaryContact.lastName}
                </span>
              )}
              <StatusBadge status={deal.status} type="deal" />
            </div>
          </div>

          {/* Actieknoppen */}
          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <FileText className="w-4 h-4" />
              Offerte maken
            </button>
            <button className="flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Receipt className="w-4 h-4" />
              Factuur maken
            </button>
            <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <ShoppingCart className="w-4 h-4" />
              Inkoop maken
            </button>
          </div>
        </div>

        {/* KPI's */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <KpiCard label="Omzet" value={formatCurrency(omzet)} />
          <KpiCard label="Verwachte marge" value={formatCurrency(marge)} sub={`${margePct.toFixed(1)}% van omzet`} />
          <KpiCard label="Offertes" value={String(deal._count.quotes)} />
          <KpiCard label="Facturen" value={String(deal._count.invoices)} />
        </div>

        {/* Tabs */}
        <TabNav tabs={[
          { label: "Producten",    href: `/deals/${id}/products` },
          { label: "Offertes",     href: `/deals/${id}/quotes` },
          { label: "Facturen",     href: `/deals/${id}/invoices` },
          { label: "Inkoop",       href: `/deals/${id}/purchase-orders` },
          { label: "Activiteiten", href: `/deals/${id}/activities` },
          { label: "Bestanden",    href: `/deals/${id}/files` },
        ]} />
      </div>

      {/* Tab inhoud */}
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
