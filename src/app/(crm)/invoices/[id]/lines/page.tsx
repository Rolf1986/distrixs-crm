import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Lock } from "lucide-react";
import { InvoiceLinesClient } from "./InvoiceLinesClient";
import { calcTotals } from "@/lib/recalc";
import { defaultVatRateForCustomer } from "@/lib/vat";

async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      customer: {
        select: {
          vatNumber: true,
          addresses: { where: { type: "BILLING" }, orderBy: { isDefault: "desc" }, take: 1, select: { country: true } },
        },
      },
    },
  });
}

async function getProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, title: true, advisorySellPrice: true },
    orderBy: { title: "asc" },
  });
}

export default async function InvoiceLinesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, products] = await Promise.all([getInvoice(id), getProducts()]);
  if (!invoice) notFound();

  const isDraft = invoice.status === "DRAFT";
  const defaultVatRate = defaultVatRateForCustomer(
    invoice.customer?.addresses[0]?.country,
    invoice.customer?.vatNumber
  );

  if (isDraft) {
    return (
      <InvoiceLinesClient
        invoiceId={id}
        defaultVatRate={defaultVatRate}
        paidAmount={Number(invoice.paidAmount)}
        initialLines={invoice.lines.map((l) => ({
          id: l.id,
          skuSnapshot: l.skuSnapshot,
          titleSnapshot: l.titleSnapshot,
          qty: Number(l.qty),
          grossUnitPrice: Number(l.grossUnitPrice),
          discountPercent: Number(l.discountPercent),
          netLineTotal: Number(l.netLineTotal),
          vatRate: Number(l.vatRate),
          vatAmount: Number(l.vatAmount),
        }))}
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          title: p.title,
          advisorySellPrice: Number(p.advisorySellPrice),
        }))}
      />
    );
  }

  // Read-only view for non-DRAFT invoices
  const { subtotal, vatBreakdown, vatAmount, total } = calcTotals(
    invoice.lines.map((l) => ({ netLineTotal: Number(l.netLineTotal), vatRate: Number(l.vatRate) }))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Factuurregels</h2>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-lg">
          <Lock className="w-3 h-3" />
          Snapshot — onwijzigbaar
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Omschrijving</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aantal</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bruto prijs</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Korting</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">BTW %</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Regel totaal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{line.skuSnapshot}</td>
                <td className="px-4 py-3 text-slate-700 font-medium">{line.titleSnapshot}</td>
                <td className="px-4 py-3 text-right text-slate-600">{Number(line.qty)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(Number(line.grossUnitPrice))}</td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {Number(line.discountPercent) > 0 ? `${Number(line.discountPercent)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{Number(line.vatRate)}%</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatCurrency(Number(line.netLineTotal))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={6} className="px-4 py-2 text-right text-sm text-slate-500">Subtotaal excl. BTW</td>
              <td className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(subtotal)}</td>
            </tr>
            {vatBreakdown.map((g) => (
              <tr key={g.rate}>
                <td colSpan={6} className="px-4 py-1.5 text-right text-sm text-slate-500">
                  BTW {g.rate}% over {formatCurrency(g.base)}
                </td>
                <td className="px-4 py-1.5 text-right font-medium text-slate-900">{formatCurrency(g.vat)}</td>
              </tr>
            ))}
            {vatBreakdown.length > 1 && (
              <tr>
                <td colSpan={6} className="px-4 py-1.5 text-right text-sm text-slate-500">Totaal BTW</td>
                <td className="px-4 py-1.5 text-right font-medium text-slate-900">{formatCurrency(vatAmount)}</td>
              </tr>
            )}
            <tr className="border-t border-slate-200">
              <td colSpan={6} className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Totaal incl. BTW</td>
              <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
