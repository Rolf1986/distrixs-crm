"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30";

type SupplierPayment = {
  id: string;
  paymentDate: string;
  amount: number;
  reference: string | null;
  createdAt: string;
};

type SupplierInvoiceDetail = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  openAmount: number;
  status: string;
  notes: string | null;
  supplier: { name: string; supplierType: string };
  purchaseOrder: { poNumber: string } | null;
  payments: SupplierPayment[];
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function PurchaseInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<SupplierInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment form
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayString());
  const [reference, setReference] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  async function fetchInvoice() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/supplier-invoices/${id}`);
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fout bij ophalen");
        return;
      }
      const data = await res.json();
      setInvoice({
        ...data,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        subtotal: Number(data.subtotal),
        vatAmount: Number(data.vatAmount),
        total: Number(data.total),
        paidAmount: Number(data.paidAmount),
        openAmount: Number(data.openAmount),
        payments: data.payments.map((p: Record<string, unknown>) => ({
          ...p,
          amount: Number(p.amount),
        })),
      });
    } catch {
      setError("Verbindingsfout");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setPaymentError("Vul een geldig bedrag in");
      return;
    }
    setPaymentLoading(true);
    setPaymentError(null);
    setPaymentSuccess(false);
    try {
      const res = await fetch(`/api/supplier-invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          paymentDate,
          reference: reference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaymentError(data.error ?? "Onbekende fout");
        return;
      }
      setAmount("");
      setPaymentDate(todayString());
      setReference("");
      setPaymentSuccess(true);
      await fetchInvoice();
      router.refresh();
    } catch {
      setPaymentError("Verbindingsfout, probeer opnieuw");
    } finally {
      setPaymentLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Laden…</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-red-500">{error ?? "Factuur niet gevonden"}</p>
      </div>
    );
  }

  const isPaid = invoice.status === "PAID";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/purchase-invoices"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Inkoopfacturen
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 font-mono">
              {invoice.invoiceNumber}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{invoice.supplier.name}</p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Invoice details card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Factuurgegevens
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-slate-500">Leverancier</span>
              <p className="text-slate-900 font-medium mt-0.5">{invoice.supplier.name}</p>
            </div>
            <div>
              <span className="text-slate-500">Inkooporder</span>
              <p className="text-slate-900 font-mono mt-0.5">
                {invoice.purchaseOrder ? (
                  <Link
                    href={`/purchase-orders/${invoice.purchaseOrder.poNumber}`}
                    className="text-blue-600 hover:underline"
                  >
                    {invoice.purchaseOrder.poNumber}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Factuurdatum</span>
              <p className="text-slate-900 mt-0.5">{formatDate(invoice.invoiceDate)}</p>
            </div>
            <div>
              <span className="text-slate-500">Vervaldatum</span>
              <p className="text-slate-900 mt-0.5">{formatDate(invoice.dueDate)}</p>
            </div>
            <div>
              <span className="text-slate-500">Subtotaal</span>
              <p className="text-slate-900 mt-0.5">{formatCurrency(invoice.subtotal)}</p>
            </div>
            <div>
              <span className="text-slate-500">BTW</span>
              <p className="text-slate-900 mt-0.5">{formatCurrency(invoice.vatAmount)}</p>
            </div>
            <div>
              <span className="text-slate-500">Totaal</span>
              <p className="text-slate-900 font-semibold text-base mt-0.5">{formatCurrency(invoice.total)}</p>
            </div>
            <div>
              <span className="text-slate-500">Openstaand</span>
              <p className={`font-semibold text-base mt-0.5 ${invoice.openAmount > 0 ? "text-orange-700" : "text-green-700"}`}>
                {formatCurrency(invoice.openAmount)}
              </p>
            </div>
            {invoice.notes && (
              <div className="col-span-2">
                <span className="text-slate-500">Notities</span>
                <p className="text-slate-700 mt-0.5 whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payments table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Betalingen ({invoice.payments.length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Referentie</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bedrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.payments.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Nog geen betalingen geregistreerd
                  </td>
                </tr>
              )}
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Register payment form */}
        {!isPaid && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
              Betaling registreren
            </h3>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bedrag (€) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={inputClass}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Betaaldatum <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Referentie
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Optioneel"
                  />
                </div>
              </div>

              {paymentError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{paymentError}</p>
              )}
              {paymentSuccess && (
                <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  Betaling succesvol geregistreerd
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {paymentLoading ? "Bezig…" : "Betaling registreren"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
