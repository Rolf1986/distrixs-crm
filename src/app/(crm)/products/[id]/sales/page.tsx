import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RowLink } from "@/components/RowLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ChevronRight, ShoppingCart } from "lucide-react";

// Aan wie is dit product verkocht? Gefactureerde regels, gematcht op
// productkoppeling óf (voor oudere/geïmporteerde facturen) op SKU.
async function getData(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, sku: true, title: true, supplier: { select: { name: true } } },
  });
  if (!product) return null;

  const lines = await prisma.invoiceLine.findMany({
    where: {
      OR: [{ productId }, { skuSnapshot: product.sku }],
      invoice: { status: { not: "DRAFT" } },
    },
    select: {
      id: true,
      qty: true,
      grossUnitPrice: true,
      netLineTotal: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          status: true,
          customer: { select: { id: true, companyName: true } },
        },
      },
    },
    orderBy: { invoice: { invoiceDate: "desc" } },
  });

  return { product, lines };
}

export default async function ProductSalesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  const { product, lines } = data;

  const sold = lines.filter((l) => l.invoice.status !== "CREDITED");
  const totalQty = sold.reduce((s, l) => s + Number(l.qty), 0);
  const totalRevenue = sold.reduce((s, l) => s + Number(l.netLineTotal), 0);
  const uniqueCustomers = new Set(sold.map((l) => l.invoice.customer.id)).size;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/products" className="hover:text-slate-600 transition-colors">Producten</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-600 font-medium">{product.title}</span>
      </div>

      {/* Header */}
      <div className="px-8 pt-3 pb-5 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-slate-400" />
          <h1 className="text-xl font-semibold text-slate-900">Verkopen — {product.title}</h1>
        </div>
        <div className="mt-1.5 text-sm text-slate-500">
          <span className="font-mono">{product.sku}</span>
          <span className="text-slate-400"> · {product.supplier.name}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5 max-w-2xl">
          <KpiCard label="Verkocht (stuks)" value={String(totalQty)} />
          <KpiCard label="Omzet excl. BTW" value={formatCurrency(totalRevenue)} />
          <KpiCard label="Unieke klanten" value={String(uniqueCustomers)} />
        </div>
      </div>

      {/* Lijst */}
      <div className="px-8 py-6">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center bg-white rounded-xl border border-slate-200">
            <p className="text-sm font-medium text-slate-600">Nog niet gefactureerd</p>
            <p className="text-xs text-slate-400 mt-1">Dit product staat op geen enkele (verzonden) factuur.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Klant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Factuur</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aantal</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stukprijs</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Regeltotaal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lines.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <RowLink href={`/invoices/${l.invoice.id}/lines`} />
                      <Link
                        href={`/customers/${l.invoice.customer.id}`}
                        className="text-brand-blue hover:underline"
                      >
                        {l.invoice.customer.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{l.invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(l.invoice.invoiceDate)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{Number(l.qty)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(Number(l.grossUnitPrice))}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(Number(l.netLineTotal))}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.invoice.status} type="invoice" />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-slate-600">
                    Totaal (excl. gecrediteerd)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{totalQty}</td>
                  <td />
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(totalRevenue)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
