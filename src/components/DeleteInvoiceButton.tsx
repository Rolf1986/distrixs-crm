"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface Props {
  invoiceId: string;
  status: string;
}

export function DeleteInvoiceButton({ invoiceId, status }: Props) {
  const router = useRouter();

  if (status !== "DRAFT") return null;

  async function handleDelete() {
    if (!window.confirm("Factuur verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/invoices");
    } else {
      const data = await res.json();
      alert(data.error ?? "Er is een fout opgetreden.");
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="flex items-center gap-1.5 border border-red-200 hover:border-red-300 bg-white text-red-600 hover:text-red-700 hover:bg-red-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
    >
      <Trash2 className="w-4 h-4" />
      Verwijderen
    </button>
  );
}
