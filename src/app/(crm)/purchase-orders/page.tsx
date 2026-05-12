import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CreatePoStandaloneButton } from "@/components/CreatePoStandaloneButton";
import { formatDate } from "@/lib/utils";

async function getSuppliers() {
  return prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, supplierType: true },
    orderBy: { name: "asc" },
  });
}

async function getPurchaseOrders() {
  return prisma.purchaseOrder.findMany({
    include: {
      supplier: { select: { name: true, supplierType: true } },
      deal: { select: { dealNumber: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { orderDate: "desc" },
  });
}

const SUPPLIER_TYPE_LABEL: Record<string, string> = {
  EU: "EU",
  CHINA: "🇨🇳 China",
  OTHER: "Overig",
};

export default async function PurchaseOrdersPage() {
  const [pos, suppliers] = await Promise.all([getPurchaseOrders(), getSuppliers()]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-8 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inkoop</h1>
          <p className="text-sm text-slate-500 mt-1">{pos.length} inkooporders</p>
        </div>
        <CreatePoStandaloneButton suppliers={suppliers} />
      </div>

      <div className="px-8">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO nummer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Leverancier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Regels</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Nog geen inkooporders
                  </td>
                </tr>
              )}
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
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                    {po.deal?.dealNumber ?? "—"}
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
        </div>
      </div>
    </div>
  );
}
