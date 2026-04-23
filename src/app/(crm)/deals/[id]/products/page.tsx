import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Plus } from "lucide-react";

async function getDealLines(dealId: string) {
  return prisma.dealLine.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
  });
}

export default async function DealProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lines = await getDealLines(id);

  const totaalOmzet = lines.reduce((s, l) => s + Number(l.netLineTotal), 0);
  const totaalMarge = lines.reduce((s, l) => s + Number(l.expectedMarginTotal), 0);
  const margePct = totaalOmzet > 0 ? (totaalMarge / totaalOmzet) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Productregels</h2>
        <button className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Regel toevoegen
        </button>
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
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Netto totaal</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Kostprijs</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Marge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  Nog geen productregels toegevoegd
                </td>
              </tr>
            )}
            {lines.map((line) => {
              const marge = Number(line.expectedMarginTotal);
              const omzet = Number(line.netLineTotal);
              const pct = omzet > 0 ? (marge / omzet) * 100 : 0;
              const isChinaSupplier = line.supplierTypeSnapshot === "CHINA";

              return (
                <tr key={line.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{line.skuSnapshot}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{line.titleSnapshot}</div>
                    {isChinaSupplier && (
                      <span className="inline-block mt-0.5 text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                        China
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{Number(line.qty)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(Number(line.grossUnitPrice))}</td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {Number(line.discountPercent) > 0 ? `${Number(line.discountPercent)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(omzet)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(Number(line.expectedCostTotal))}</td>
                  <td className="px-4 py-3 text-right">
                    <div className={pct >= 30 ? "text-green-700 font-medium" : pct >= 15 ? "text-slate-700" : "text-red-600 font-medium"}>
                      {formatCurrency(marge)}
                    </div>
                    <div className="text-xs text-slate-400">{pct.toFixed(1)}%</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-700">Totaal</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(totaalOmzet)}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right">
                  <div className={`font-semibold ${margePct >= 30 ? "text-green-700" : margePct >= 15 ? "text-slate-900" : "text-red-600"}`}>
                    {formatCurrency(totaalMarge)}
                  </div>
                  <div className="text-xs text-slate-400">{margePct.toFixed(1)}%</div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
