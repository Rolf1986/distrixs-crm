import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { TabNav } from "@/components/TabNav";
import { PoStatusActions } from "@/components/PoStatusActions";
import { PoSupplierSelect } from "@/components/PoSupplierSelect";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

async function getSuppliers() {
  return prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, supplierType: true },
    orderBy: { name: "asc" },
  });
}

async function getPurchaseOrder(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, supplierType: true } },
      deal: { select: { id: true, dealNumber: true } },
      lines: { select: { baseCostSnapshot: true, qtyOrdered: true } },
      extraCosts: { select: { amount: true, costType: true } },
    },
  });
}

export default async function PurchaseOrderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [po, suppliers] = await Promise.all([getPurchaseOrder(id), getSuppliers()]);
  if (!po) notFound();

  const isChina = po.supplier.supplierType === "CHINA";

  // Base cost total
  const baseCostTotal = po.lines.reduce(
    (s, l) => s + Number(l.baseCostSnapshot) * Number(l.qtyOrdered),
    0
  );

  // Extra costs
  const extraCostTotal = po.extraCosts.reduce((s, c) => s + Number(c.amount), 0);

  // China standard extras: 8% shipping + 6% import duties (on base cost)
  const chinaEstShipping = isChina ? baseCostTotal * 0.08 : 0;
  const chinaEstImport = isChina ? baseCostTotal * 0.06 : 0;
  const totalExpectedCost = baseCostTotal + extraCostTotal + chinaEstShipping + chinaEstImport;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/purchase-orders" className="hover:text-slate-600 transition-colors">Inkoop</Link>
        {po.deal && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href={`/deals/${po.deal.id}/purchase-orders`} className="hover:text-slate-600 transition-colors">
              {po.deal.dealNumber}
            </Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-600 font-medium font-mono">{po.poNumber}</span>
      </div>

      {/* Header */}
      <div className="px-8 pt-3 pb-5 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900 font-mono">{po.poNumber}</h1>
              <StatusBadge status={po.status} type="po" />
              {isChina && (
                <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 rounded px-2 py-0.5">
                  🇨🇳 China — +8% shipping, +6% invoerrechten
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
              <PoSupplierSelect
                poId={id}
                currentSupplierId={po.supplierId}
                currentSupplierName={po.supplier.name}
                suppliers={suppliers}
              />
              <span className="text-slate-400">· {formatDate(po.orderDate)}</span>
            </div>
          </div>

          <PoStatusActions poId={id} currentStatus={po.status as "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CLOSED" | "CANCELLED"} />
        </div>

        {/* KPI's */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <KpiCard label="Basiskosten" value={formatCurrency(baseCostTotal)} />
          {isChina ? (
            <>
              <KpiCard label="Geschat transport" value={formatCurrency(chinaEstShipping)} sub="8% van basiskosten" />
              <KpiCard label="Geschatte invoerrechten" value={formatCurrency(chinaEstImport)} sub="6% van basiskosten" />
            </>
          ) : (
            <KpiCard label="Extra kosten" value={formatCurrency(extraCostTotal)} />
          )}
          <KpiCard
            label="Verwachte totaalkosten"
            value={formatCurrency(totalExpectedCost)}
            highlight
          />
        </div>

        {/* Tabs */}
        <TabNav tabs={[
          { label: "Regels",       href: `/purchase-orders/${id}/lines` },
          { label: "Extra kosten", href: `/purchase-orders/${id}/extra-costs` },
        ]} />
      </div>

      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
