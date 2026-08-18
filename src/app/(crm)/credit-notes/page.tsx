import Link from "next/link";
import { RowLink } from "@/components/RowLink";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";

async function getCreditNotes() {
  const creditNotes = await prisma.creditNote.findMany({
    include: {
      customer: { select: { id: true, companyName: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { creditNoteDate: "desc" },
  });
  // Verrekend? (betaling met vast referentieformaat op de gekoppelde factuur)
  const settlements = await prisma.payment.findMany({
    where: { reference: { startsWith: "Verrekening " } },
    select: { reference: true },
  });
  const settledRefs = new Set(settlements.map((s) => s.reference));
  return creditNotes.map((cn) => ({
    ...cn,
    settled: settledRefs.has(`Verrekening ${cn.creditNoteNumber}`),
  }));
}

export default async function CreditNotesPage() {
  const creditNotes = await getCreditNotes();

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Creditnota's"
        description={`${creditNotes.length} creditnota${creditNotes.length !== 1 ? "'s" : ""}`}
      />
      <div className="px-8 py-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Nummer
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Datum
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Klant
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Factuurref.
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Totaal
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {creditNotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nog geen creditnota&apos;s
                  </td>
                </tr>
              )}
              {creditNotes.map((cn) => (
                <tr
                  key={cn.id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group relative"
                >
                  <td className="px-4 py-3 font-mono font-medium text-slate-900">
                    <RowLink href={`/credit-notes/${cn.id}`} />
                    <span className="group-hover:text-brand-blue transition-colors">
                      {cn.creditNoteNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(cn.creditNoteDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {cn.customer.companyName}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    <Link
                      href={`/invoices/${cn.invoice.id}/lines`}
                      className="relative z-10 text-brand-blue hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {cn.invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(Number(cn.total))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {cn.settled ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Verrekend
                        </span>
                      ) : cn.refundedAt ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Terugbetaald
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                          Open
                        </span>
                      )}
                      {cn.twinfieldSyncStatus === "SYNCED" && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600"
                          title={cn.twinfieldReference ? `Twinfield-boeking ${cn.twinfieldReference}` : "Geboekt in Twinfield"}
                        >
                          TF
                        </span>
                      )}
                    </div>
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
