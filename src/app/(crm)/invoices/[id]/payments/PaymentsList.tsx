"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Overboeking",
  MOLLIE: "Mollie",
  WERO: "Wero",
  OTHER: "Overig",
};

type Payment = {
  id: string;
  paymentDate: string;
  method: string;
  reference: string | null;
  amount: number;
};

interface Props {
  invoiceId: string;
  payments: Payment[];
  openAmount: number;
  locked: boolean;
}

export function PaymentsList({ invoiceId, payments: initial, openAmount, locked }: Props) {
  const router = useRouter();
  const [payments, setPayments] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function deletePayment(paymentId: string) {
    setDeletingId(paymentId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments/${paymentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPayments(prev => prev.filter(p => p.id !== paymentId));
        setConfirmId(null);
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-8 text-center text-slate-400 text-sm">
        Nog geen betalingen geregistreerd
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Methode</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Referentie</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bedrag</th>
            {!locked && <th className="w-20" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 text-slate-600">{formatDate(new Date(p.paymentDate))}</td>
              <td className="px-4 py-3 text-slate-600">{METHOD_LABEL[p.method] ?? p.method}</td>
              <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.reference ?? "—"}</td>
              <td className="px-4 py-3 text-right font-semibold text-green-700">
                {formatCurrency(p.amount)}
              </td>
              {!locked && (
                <td className="px-4 py-3 text-right">
                  {confirmId === p.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-slate-500">Verwijderen?</span>
                      <button
                        onClick={() => deletePayment(p.id)}
                        disabled={deletingId === p.id}
                        className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
                      >
                        {deletingId === p.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                          : "Ja"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Nee
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(p.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                      title="Betaling verwijderen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-200 bg-slate-50">
          <tr>
            <td colSpan={locked ? 3 : 4} className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
              Open bedrag
            </td>
            <td className={`px-4 py-3 text-right font-bold ${openAmount > 0 ? "text-slate-900" : "text-green-700"}`}>
              {formatCurrency(openAmount)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
