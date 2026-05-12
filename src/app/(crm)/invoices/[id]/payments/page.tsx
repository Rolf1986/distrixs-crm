import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { AddPaymentForm } from "./AddPaymentForm";
import { PaymentsList } from "./PaymentsList";
import { InvoiceNotesEditor } from "@/components/InvoiceNotesEditor";
import { Bell } from "lucide-react";

const REMINDER_TYPE_LABEL: Record<string, string> = {
  FIRST: "1e herinnering",
  SECOND: "2e herinnering",
  FINAL: "Laatste aanmaning",
  LEGAL: "Juridische aanmaning",
};

async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      total: true,
      openAmount: true,
      notes: true,
      twinfieldLocked: true,
      payments: { orderBy: { paymentDate: "desc" } },
      reminders: { orderBy: { sentAt: "desc" } },
    },
  });
}

export default async function InvoicePaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const locked = invoice.twinfieldLocked;

  return (
    <div className="space-y-8">

      {/* ── Opmerking ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Opmerking op factuur
        </h2>
        <p className="text-xs text-slate-400 mb-2">
          Deze opmerking wordt weergegeven op de PDF voor de klant.
        </p>
        <InvoiceNotesEditor
          invoiceId={id}
          value={invoice.notes ?? null}
          locked={locked}
        />
      </div>

      {/* ── Betalingen ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Betalingen
        </h2>
        <PaymentsList
          invoiceId={id}
          payments={invoice.payments.map(p => ({
            id: p.id,
            paymentDate: p.paymentDate.toISOString(),
            method: p.method,
            reference: p.reference,
            amount: Number(p.amount),
          }))}
          openAmount={Number(invoice.openAmount)}
          locked={locked}
        />
      </div>

      <AddPaymentForm
        invoiceId={invoice.id}
        invoiceStatus={invoice.status}
        twinfieldLocked={invoice.twinfieldLocked}
      />

      {/* ── Herinneringen ────────────────────────────────────────── */}
      {invoice.reminders.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Verstuurde herinneringen ({invoice.reminders.length})
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notitie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoice.reminders.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-slate-600">{formatDate(r.sentAt)}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {REMINDER_TYPE_LABEL[r.reminderType] ?? r.reminderType}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
