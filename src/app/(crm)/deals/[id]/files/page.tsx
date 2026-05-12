import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FileText, Receipt, ShoppingCart } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const PO_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verzonden",
  CONFIRMED: "Bevestigd",
  DELIVERED: "Geleverd",
  CANCELLED: "Geannuleerd",
};

async function getDealDocuments(dealId: string) {
  return prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      quotes: {
        select: { id: true, quoteNumber: true, status: true, total: true, quoteDate: true },
        orderBy: { quoteDate: "desc" },
      },
      invoices: {
        select: { id: true, invoiceNumber: true, status: true, total: true, invoiceDate: true },
        orderBy: { invoiceDate: "desc" },
      },
      purchaseOrders: {
        select: { id: true, poNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verzonden",
  ACCEPTED: "Aanvaard",
  REJECTED: "Afgewezen",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verzonden",
  PARTIALLY_PAID: "Deels betaald",
  PAID: "Betaald",
  OVERDUE: "Verlopen",
  CREDITED: "Gecrediteerd",
};

export default async function DealFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealDocuments(id);
  if (!deal) notFound();

  const totalDocs =
    deal.quotes.length + deal.invoices.length + deal.purchaseOrders.length;

  return (
    <div className="space-y-6">
      {totalDocs === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-10 text-center text-slate-400 text-sm">
          Nog geen documenten beschikbaar voor deze deal
        </div>
      )}

      {/* Offertes */}
      {deal.quotes.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Offertes ({deal.quotes.length})
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {deal.quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <Link
                      href={`/quotes/${q.id}/lines`}
                      className="text-sm font-medium font-mono text-slate-900 hover:text-brand-blue transition-colors"
                    >
                      {q.quoteNumber}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(q.quoteDate)} · {QUOTE_STATUS_LABEL[q.status] ?? q.status} · {formatCurrency(Number(q.total))}
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/quotes/${q.id}/pdf`}
                  download
                  className="flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue-dark border border-brand-blue/20 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors bg-brand-blue-light hover:bg-brand-blue-light"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Facturen */}
      {deal.invoices.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Receipt className="w-3.5 h-3.5" />
            Facturen ({deal.invoices.length})
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {deal.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <Link
                      href={`/invoices/${inv.id}/lines`}
                      className="text-sm font-medium font-mono text-slate-900 hover:text-brand-blue transition-colors"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(inv.invoiceDate)} · {INVOICE_STATUS_LABEL[inv.status] ?? inv.status} · {formatCurrency(Number(inv.total))}
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/invoices/${inv.id}/pdf`}
                  download
                  className="flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue-dark border border-brand-blue/20 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors bg-brand-blue-light hover:bg-brand-blue-light"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Inkooporders */}
      {deal.purchaseOrders.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <ShoppingCart className="w-3.5 h-3.5" />
            Inkooporders ({deal.purchaseOrders.length})
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {deal.purchaseOrders.map((po) => (
              <div key={po.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <Link
                      href={`/deals/${id}/purchase-orders`}
                      className="text-sm font-medium font-mono text-slate-900 hover:text-brand-blue transition-colors"
                    >
                      {po.poNumber}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(po.createdAt)} · {PO_STATUS_LABEL[po.status] ?? po.status}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
