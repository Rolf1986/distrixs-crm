import { notFound } from "next/navigation";
import { RowLink } from "@/components/RowLink";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

async function getCustomerInvoices(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return null;

  return prisma.invoice.findMany({
    where: { customerId },
    include: {
      deal: { select: { id: true, dealNumber: true } },
    },
    orderBy: { invoiceDate: "desc" },
  });
}

export default async function CustomerInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoices = await getCustomerInvoices(id);
  if (!invoices) notFound();

  const totalOpen = invoices.reduce((s, inv) => s + Number(inv.openAmount), 0);
  const totalRevenue = invoices.reduce((s, inv) => s + Number(inv.total), 0);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      {invoices.length > 0 && (
        <div className="flex gap-4">
          <div className="bg-white rounded-lg border border-slate-200 px-5 py-3 text-sm">
            <span className="text-slate-500">Totale omzet</span>{" "}
            <span className="font-semibold text-slate-900">{formatCurrency(totalRevenue)}</span>
          </div>
          {totalOpen > 0 && (
            <div className="bg-orange-50 rounded-lg border border-orange-200 px-5 py-3 text-sm">
              <span className="text-orange-600">Open bedrag</span>{" "}
              <span className="font-semibold text-orange-700">{formatCurrency(totalOpen)}</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nummer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Deal</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vervaldatum</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totaal</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Open</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Nog geen facturen voor deze klant
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const isOverdue =
                inv.status === "OVERDUE" ||
                ((inv.status === "SENT" || inv.status === "PARTIALLY_PAID") &&
                  new Date(inv.dueDate) < new Date());
              return (
                <tr
                  key={inv.id}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer relative ${
                    isOverdue ? "bg-red-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-medium text-slate-900">
                    <RowLink href={`/invoices/${inv.id}/lines`} />
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                    {inv.deal
                      ? <Link href={`/deals/${inv.deal.id}/invoices`} className="relative hover:text-brand-blue z-10">{inv.deal.dealNumber}</Link>
                      : <span className="text-slate-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                  <td className={`px-4 py-3 ${isOverdue ? "text-red-600 font-medium" : "text-slate-500"}`}>
                    {formatDate(inv.dueDate)}
                    {isOverdue && <span className="ml-1 text-xs">⚠</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(Number(inv.total))}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${
                    Number(inv.openAmount) > 0
                      ? isOverdue ? "text-red-600" : "text-slate-700"
                      : "text-slate-400"
                  }`}>
                    {formatCurrency(Number(inv.openAmount))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} type="invoice" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
