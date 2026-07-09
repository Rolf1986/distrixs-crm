"use client";

import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";

export function DnRowActions({
  dnId,
  deliveryNumber,
}: {
  dnId: string;
  deliveryNumber: string;
}) {
  const router = useRouter();

  async function remove() {
    if (!confirm(`Verzenddocument ${deliveryNumber} verwijderen?`)) return;
    const res = await fetch(`/api/delivery-notes/${dnId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? "Verwijderen mislukt");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1 relative z-10">
      <a
        href={`/api/delivery-notes/${dnId}/pdf`}
        download={`${deliveryNumber}.pdf`}
        title="Download PDF"
        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue-light transition-colors"
      >
        <Download className="w-4 h-4" />
      </a>
      <button
        onClick={remove}
        title="Verwijderen"
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
