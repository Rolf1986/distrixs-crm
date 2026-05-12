import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Lock } from "lucide-react";
import { QuoteLinesClient } from "./QuoteLinesClient";
import { calcTotals } from "@/lib/recalc";

async function getQuote(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
}

async function getProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, title: true, advisorySellPrice: true, baseCostPrice: true },
    orderBy: { title: "asc" },
  });
}

export default async function QuoteLinesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quote, products] = await Promise.all([getQuote(id), getProducts()]);
  if (!quote) notFound();

  const isDraft = quote.status === "DRAFT";

  if (isDraft) {
    return (
      <QuoteLinesClient
        quoteId={id}
        initialLines={quote.lines.map((l) => ({
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
          baseCostPrice: Number(p.baseCostPrice),
        }))}
      />
    );
  }

  // Read-only view for non-DRAFT quotes
  const lines = quote.lines;
  const { subtotal, vatBreakdown, vatAmount, total } = calcTotals(
    lines.map((l) => ({ netLineTotal: Number(l.netLineTotal), vatRate: Number(l.vatRate) }))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Offerteregels</h2>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-lg">
          <Lock className="w-3 h-3" />
          Snapshot — onwijzigbaar
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Omschrijving</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Aantal</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Bruto prijs</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Korting</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">BTW %</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Regel totaal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Geen regels
                </td>
              </tr>
            )}
            {lines.map((line) => (
              <tr key={line.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{line.skuSnapshot}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{line.titleSnapshot}</td>
                <td className="px-4 py-3 text-right text-slate-700">{Number(line.qty)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(Number(line.grossUnitPrice))}</td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {Number(line.discountPercent) > 0 ? `${Number(line.discountPercent)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{Number(line.vatRate)}%</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">
                  {formatCurrency(Number(line.netLineTotal))}
                </td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-100">
                <td colSpan={6} className="px-4 py-3 text-right text-sm text-slate-500">Subtotaal excl. BTW</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(subtotal)}</td>
              </tr>
              {vatBreakdown.map((g) => (
                <tr key={g.rate}>
                  <td colSpan={6} className="px-4 py-1.5 text-right text-sm text-slate-500">
                    BTW {g.rate}% over {formatCurrency(g.base)}
                  </td>
                  <td className="px-4 py-1.5 text-right text-slate-700">{formatCurrency(g.vat)}</td>
                </tr>
              ))}
              {vatBreakdown.length > 1 && (
                <tr>
                  <td colSpan={6} className="px-4 py-1.5 text-right text-sm text-slate-500">Totaal BTW</td>
                  <td className="px-4 py-1.5 text-right text-slate-700">{formatCurrency(vatAmount)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={6} className="px-4 py-3 text-right font-semibold text-slate-700">Totaal incl. BTW</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
