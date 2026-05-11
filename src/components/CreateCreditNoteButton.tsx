"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileX, Loader2, AlertTriangle } from "lucide-react";

interface CreateCreditNoteButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
}

const CREDITABLE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"];

export function CreateCreditNoteButton({
  invoiceId,
  invoiceNumber,
  status,
}: CreateCreditNoteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!CREDITABLE_STATUSES.includes(status)) return null;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/credit-note`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Er is een fout opgetreden");
        setLoading(false);
        return;
      }
      const { id } = await res.json();
      router.push(`/credit-notes/${id}`);
    } catch {
      setError("Netwerkfout — probeer het opnieuw");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border border-slate-200 hover:border-red-300 bg-white text-slate-700 hover:text-red-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        title="Creditnota aanmaken"
      >
        <FileX className="w-4 h-4" />
        Creditnota
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-50 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Creditnota aanmaken</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Weet je zeker dat je een creditnota wilt aanmaken voor{" "}
                  <span className="font-mono font-semibold text-slate-700">{invoiceNumber}</span>?
                  De factuur wordt gecrediteerd.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50"
              >
                Annuleren
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Creditnota aanmaken
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
