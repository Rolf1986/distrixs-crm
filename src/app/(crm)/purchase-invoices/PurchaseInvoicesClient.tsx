"use client";

import { RowLink } from "@/components/RowLink";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

type SupplierInvoiceRow = {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  openAmount: number;
  status: string;
  poNumber: string | null;
};

type Supplier = { id: string; name: string };
type PurchaseOrder = { id: string; poNumber: string; supplierId: string };

interface Props {
  invoices: SupplierInvoiceRow[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
}

const STATUS_FILTERS = [
  { key: "all", label: "Alle" },
  { key: "OPEN", label: "Open" },
  { key: "PARTIALLY_PAID", label: "Deels betaald" },
  { key: "OVERDUE", label: "Verlopen" },
  { key: "PAID", label: "Betaald" },
  { key: "DISPUTED", label: "Betwist" },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === "PAID") return false;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function PurchaseInvoicesClient({ invoices, suppliers, purchaseOrders }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayString());
  const [dueDate, setDueDate] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [total, setTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = invoices.filter((inv) => {
    const overdue = isOverdue(inv.dueDate, inv.status);

    const matchesFilter =
      filter === "all" ||
      (filter === "OVERDUE" && overdue) ||
      inv.status === filter;

    const matchesSearch =
      !search ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      (inv.poNumber ?? "").toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Filtered POs for the selected supplier
  const filteredPos = supplierId
    ? purchaseOrders.filter((po) => po.supplierId === supplierId)
    : purchaseOrders;

  function resetForm() {
    setSupplierId("");
    setPurchaseOrderId("");
    setInvoiceNumber("");
    setInvoiceDate(todayString());
    setDueDate("");
    setSubtotal("");
    setVatAmount("");
    setTotal("");
    setNotes("");
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/supplier-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          purchaseOrderId: purchaseOrderId || undefined,
          invoiceNumber,
          invoiceDate,
          dueDate,
          subtotal: subtotal ? Number(subtotal) : 0,
          vatAmount: vatAmount ? Number(vatAmount) : 0,
          total: Number(total),
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Onbekende fout");
        return;
      }
      setShowModal(false);
      resetForm();
      router.refresh();
    } catch {
      setFormError("Verbindingsfout, probeer opnieuw");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.key === "all"
                ? invoices.length
                : f.key === "OVERDUE"
                ? invoices.filter((i) => isOverdue(i.dueDate, i.status)).length
                : invoices.filter((i) => i.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {f.label}
                {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Zoeken…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-48"
          />
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nieuwe inkoopfactuur
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Leverancier</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Factuurnr.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vervaldatum</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totaal</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Openstaand</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Geen inkoopfacturen gevonden
                </td>
              </tr>
            )}
            {filtered.map((inv) => {
              const overdue = isOverdue(inv.dueDate, inv.status);
              return (
                <tr
                  key={inv.id}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer group relative ${
                    overdue ? "bg-red-50/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-slate-700">
                    <RowLink href={`/purchase-invoices/${inv.id}`} />
                    {inv.supplierName}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3">
                    <span className={overdue ? "text-red-600 font-medium" : "text-slate-500"}>
                      {formatDate(inv.dueDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{inv.poNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(inv.total)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${inv.openAmount > 0 ? (overdue ? "text-red-600" : "text-slate-700") : "text-slate-300"}`}>
                    {formatCurrency(inv.openAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Nieuwe inkoopfactuur</h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Leverancier <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputClass}
                  value={supplierId}
                  onChange={(e) => { setSupplierId(e.target.value); setPurchaseOrderId(""); }}
                  required
                >
                  <option value="">Selecteer leverancier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Inkooporder (optioneel)
                </label>
                <select
                  className={inputClass}
                  value={purchaseOrderId}
                  onChange={(e) => setPurchaseOrderId(e.target.value)}
                  disabled={!supplierId}
                >
                  <option value="">Geen inkooporder</option>
                  {filteredPos.map((po) => (
                    <option key={po.id} value={po.id}>{po.poNumber}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Factuurnummer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="bijv. INV-2026-001"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Factuurdatum <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vervaldatum <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bedrag excl. BTW
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    BTW bedrag
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={vatAmount}
                    onChange={(e) => setVatAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Totaal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={inputClass}
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    placeholder="0,00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notities (intern)
                </label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optioneel"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                >
                  {submitting ? "Bezig…" : "Aanmaken"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
