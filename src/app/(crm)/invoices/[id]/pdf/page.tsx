import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, FileText } from "lucide-react";

async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      contact: true,
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
}

export default async function InvoicePdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">PDF / Download</h2>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900">{invoice.invoiceNumber}.pdf</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {invoice.customer.companyName} · {formatDate(invoice.invoiceDate)} · {formatCurrency(Number(invoice.total))}
            </p>
          </div>
          <a
            href={`/api/invoices/${id}/pdf`}
            download={`${invoice.invoiceNumber}.pdf`}
            className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        </div>

        {/* Preview table */}
        <div className="mt-6 border border-slate-100 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Voorvertoning inhoud</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-2.5 text-xs text-slate-400 font-medium">Omschrijving</th>
                <th className="text-right px-4 py-2.5 text-xs text-slate-400 font-medium">Aantal</th>
                <th className="text-right px-4 py-2.5 text-xs text-slate-400 font-medium">Prijs</th>
                <th className="text-right px-4 py-2.5 text-xs text-slate-400 font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 text-slate-700">{l.titleSnapshot}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{Number(l.qty)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{formatCurrency(Number(l.grossUnitPrice))}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{formatCurrency(Number(l.netLineTotal))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <td colSpan={3} className="px-4 py-2 text-right text-slate-500 text-xs">Subtotaal</td>
                <td className="px-4 py-2 text-right text-slate-700 font-medium">{formatCurrency(Number(invoice.subtotal))}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-1.5 text-right text-slate-500 text-xs">BTW 21%</td>
                <td className="px-4 py-1.5 text-right text-slate-500">{formatCurrency(Number(invoice.vatAmount))}</td>
              </tr>
              <tr className="bg-brand-blue-light">
                <td colSpan={3} className="px-4 py-2.5 text-right font-semibold text-slate-700">Totaal incl. BTW</td>
                <td className="px-4 py-2.5 text-right font-bold text-brand-blue">{formatCurrency(Number(invoice.total))}</td>
              </tr>
              {Number(invoice.openAmount) > 0 && Number(invoice.openAmount) !== Number(invoice.total) && (
                <tr className="bg-orange-50">
                  <td colSpan={3} className="px-4 py-2 text-right text-orange-600 text-xs font-medium">Nog open</td>
                  <td className="px-4 py-2 text-right text-orange-700 font-semibold">{formatCurrency(Number(invoice.openAmount))}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
