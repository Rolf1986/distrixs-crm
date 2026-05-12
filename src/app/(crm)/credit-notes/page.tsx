import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";

async function getCreditNotes() {
  return prisma.creditNote.findMany({
    include: {
      customer: { select: { id: true, companyName: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { creditNoteDate: "desc" },
  });
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {creditNotes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
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
                    <Link href={`/credit-notes/${cn.id}`} className="absolute inset-0" />
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
