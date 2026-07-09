import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { CreatePoButton } from "@/components/CreatePoButton";

async function getDealPos(dealId: string) {
  return prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      purchaseOrders: {
        include: {
          supplier: { select: { name: true, supplierType: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { orderDate: "desc" },
      },
    },
  });
}

const SUPPLIER_TYPE_LABEL: Record<string, string> = {
  EU: "EU",
  CHINA: "🇨🇳 China",
  OTHER: "Overig",
};

export default async function DealPurchaseOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [deal, suppliers] = await Promise.all([
    getDealPos(id),
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, supplierType: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!deal) notFound();

  const pos = deal.purchaseOrders;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Inkooporders ({pos.length})
        </h2>
        <CreatePoButton dealId={id} suppliers={suppliers} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {pos.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">
            Nog geen inkooporders voor deze deal
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO nummer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Leverancier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Regels</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pos.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-slate-900 relative">
                    <Link href={`/purchase-orders/${po.id}/lines`} className="absolute inset-0" />
                    {po.poNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{po.supplier.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {SUPPLIER_TYPE_LABEL[po.supplier.supplierType] ?? po.supplier.supplierType}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(po.orderDate)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{po._count.lines}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={po.status} type="po" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
