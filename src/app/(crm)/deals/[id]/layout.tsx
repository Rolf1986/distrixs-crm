import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { TabNav } from "@/components/TabNav";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { CreateQuoteButton } from "@/components/CreateQuoteButton";
import { CreatePoButton } from "@/components/CreatePoButton";
import { DealStatusActions } from "@/components/DealStatusActions";
import { DealPipeline } from "@/components/DealPipeline";
import { WinProbabilityEditor } from "@/components/WinProbabilityEditor";
import { ExpectedCloseDateEditor } from "@/components/ExpectedCloseDateEditor";
import { DealOrderReferenceEditor } from "@/components/DealOrderReferenceEditor";

async function getDeal(id: string) {
  return prisma.deal.findUnique({
    where: { id },
    include: {
      customer: true,
      primaryContact: true,
      // KPI's komen uit offertes, niet uit dealregels
      quotes: {
        select: { subtotal: true, total: true, status: true },
      },
      _count: { select: { quotes: true, invoices: true, purchaseOrders: true } },
    },
  });
}

async function getSuppliers() {
  return prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, supplierType: true },
    orderBy: { name: "asc" },
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
  const [deal, suppliers] = await Promise.all([getDeal(id), getSuppliers()]);
  if (!deal) notFound();

  // Bereken omzet uit offertes (voorkeur: geaccepteerde, anders verzonden, anders alle niet-afgewezen)
  const activeQuotes = deal.quotes.filter(
    (q) => q.status !== "REJECTED"
  );
  const omzet = activeQuotes.reduce((s, q) => s + Number(q.total), 0);

  const isOpenStatus = deal.status !== "WON" && deal.status !== "LOST";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/deals" className="hover:text-slate-600 transition-colors">Deals</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-600 font-medium">{deal.dealNumber}</span>
      </div>

      {/* Header */}
      <div className="px-8 pt-3 pb-0 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{deal.title}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <Link href={`/customers/${deal.customerId}`} className="text-sm text-brand-blue hover:underline">
                {deal.customer.companyName}
              </Link>
              {deal.primaryContact && (
                <span className="text-sm text-slate-400">
                  · {deal.primaryContact.firstName} {deal.primaryContact.lastName}
                </span>
              )}
              <WinProbabilityEditor dealId={id} value={deal.winProbability ?? null} />
              <ExpectedCloseDateEditor dealId={id} value={deal.expectedCloseDate ?? null} />
              <DealOrderReferenceEditor dealId={id} value={deal.orderReference ?? null} />
            </div>
          </div>

          {/* Actieknoppen */}
          <div className="flex items-center gap-3 shrink-0">
            <DealStatusActions dealId={id} currentStatus={deal.status} />
            <div className="w-px h-6 bg-slate-200" />
            <CreateQuoteButton dealId={id} />
            <CreatePoButton dealId={id} suppliers={suppliers} />
          </div>
        </div>

        {/* Pipeline progress bar — alleen bij open deals */}
        {isOpenStatus && (
          <div className="pb-2">
            <DealPipeline dealId={id} status={deal.status} />
          </div>
        )}

        {/* KPI's — gebaseerd op offertes */}
        <div className="grid grid-cols-3 gap-3 py-4 border-t border-slate-100">
          <KpiCard
            label="Offertewaarde"
            value={formatCurrency(omzet)}
            sub={omzet === 0 ? "Nog geen offertes" : `${activeQuotes.length} offerte${activeQuotes.length !== 1 ? "s" : ""}`}
            highlight={omzet > 0}
          />
          <KpiCard label="Offertes" value={String(deal._count.quotes)} />
          <KpiCard label="Facturen" value={String(deal._count.invoices)} />
        </div>

        {/* Tabs — geen Producten tab */}
        <TabNav tabs={[
          { label: "Info",             href: `/deals/${id}/info`,               exact: true },
          { label: "Offertes",         href: `/deals/${id}/quotes` },
          { label: "Orderbevestiging", href: `/deals/${id}/order-confirmations` },
          { label: "Verzenddocument",  href: `/deals/${id}/delivery-notes` },
          { label: "Facturen",         href: `/deals/${id}/invoices` },
          { label: "Inkoop",           href: `/deals/${id}/purchase-orders` },
          { label: "E-mails",          href: `/deals/${id}/emails` },
          { label: "Activiteiten",     href: `/deals/${id}/activities` },
          { label: "Bestanden",        href: `/deals/${id}/files` },
        ]} />
      </div>

      {/* Tab inhoud */}
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
