import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreateCreditNoteButton } from "@/components/CreateCreditNoteButton";
import { SettleCreditNoteButton } from "@/components/SettleCreditNoteButton";
import { FileX, ExternalLink, Download } from "lucide-react";
import { RowLink } from "@/components/RowLink";

async function getInvoiceWithCreditNotes(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      total: true,
      lines: {
        select: { id: true, skuSnapshot: true, titleSnapshot: true, qty: true, grossUnitPrice: true, netLineTotal: true, vatRate: true },
        orderBy: { createdAt: "asc" },
      },
      creditNotes: {
        include: {
          lines: { select: { lineTotal: true } },
          createdByUser: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export default async function InvoiceCreditNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceWithCreditNotes(id);
  if (!invoice) notFound();

  const creditNotes = invoice.creditNotes;
  const totalCredited = creditNotes.reduce((s, cn) => s + Number(cn.total), 0);

  // Welke creditnota's zijn al verrekend? (betaling met vast referentieformaat)
  const settlements = await prisma.payment.findMany({
    where: { invoiceId: id, reference: { startsWith: "Verrekening " } },
    select: { reference: true },
  });
  const settledRefs = new Set(settlements.map((s) => s.reference));

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header + actieknop */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {creditNotes.length === 0
              ? "Nog geen creditnota's aangemaakt voor deze factuur."
              : `${creditNotes.length} creditnota${creditNotes.length !== 1 ? "'s" : ""} · totaal gecrediteerd: ${formatCurrency(totalCredited)}`}
          </p>
        </div>
        <CreateCreditNoteButton
          invoiceId={id}
          invoiceNumber={invoice.invoiceNumber}
          status={invoice.status}
          lines={invoice.lines.map((l) => ({
            id: l.id,
            skuSnapshot: l.skuSnapshot,
            titleSnapshot: l.titleSnapshot,
            qty: Number(l.qty),
            grossUnitPrice: Number(l.grossUnitPrice),
            netLineTotal: Number(l.netLineTotal),
            vatRate: Number(l.vatRate),
          }))}
        />
      </div>

      {/* Lijst */}
      {creditNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <FileX className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Geen creditnota's</p>
          <p className="text-xs text-slate-400 mt-1">
            Maak een creditnota aan om deze factuur geheel of gedeeltelijk te crediteren.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nummer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reden</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aangemaakt door</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totaal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Verrekening</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {creditNotes.map((cn) => (
                <tr key={cn.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm font-medium text-slate-900">
                    {cn.creditNoteNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(cn.creditNoteDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {cn.reason ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {cn.createdByUser?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    {formatCurrency(Number(cn.total))}
                  </td>
                  <td className="px-4 py-3">
                    <SettleCreditNoteButton
                      creditNoteId={cn.id}
                      settled={settledRefs.has(`Verrekening ${cn.creditNoteNumber}`)}
                      compact
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RowLink href={`/credit-notes/${cn.id}`} />
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/credit-notes/${cn.id}/pdf`}
                        className="text-slate-400 hover:text-brand-blue transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <Link
                        href={`/credit-notes/${cn.id}`}
                        className="text-slate-400 hover:text-brand-blue transition-colors"
                        title="Bekijk creditnota"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {creditNotes.length > 1 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-slate-600">
                    Totaal gecrediteerd
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    {formatCurrency(totalCredited)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
