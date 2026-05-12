import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreateInvoiceFromDealButton } from "@/components/CreateInvoiceFromDealButton";

async function getDealInvoices(dealId: string) {
  return prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      customerId: true,
      invoices: {
        include: { customer: { select: { companyName: true } } },
        orderBy: { invoiceDate: "desc" },
      },
    },
  });
}

export default async function DealInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealInvoices(id);
  if (!deal) notFound();

  const invoices = deal.invoices;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Facturen ({invoices.length})
        </h2>
        <CreateInvoiceFromDealButton dealId={id} customerId={deal.customerId} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">
            Nog geen facturen voor deze deal
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nummer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vervaldatum</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totaal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Open</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-slate-900 relative">
                    <Link href={`/invoices/${inv.id}/lines`} className="absolute inset-0" />
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(Number(inv.total))}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formatCurrency(Number(inv.openAmount))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} type="invoice" />
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
