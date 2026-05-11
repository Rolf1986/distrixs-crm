"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { CreateModal, FormField, inputClass } from "@/components/ui/CreateModal";

interface Props {
  dealId: string;
  orderConfirmations: { id: string; confirmationNumber: string }[];
}

export function CreateDeliveryNoteButton({ dealId, orderConfirmations }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationId, setConfirmationId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setConfirmationId("");
    setDeliveryDate("");
    setCarrier("");
    setTrackingCode("");
    setNotes("");
    setError("");
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/delivery-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          confirmationId: confirmationId || null,
          deliveryDate: deliveryDate || null,
          carrier: carrier || null,
          trackingCode: trackingCode || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fout"); return; }
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Truck className="w-4 h-4" />
        Verzenddocument maken
      </button>
      {open && (
        <CreateModal title="Nieuw verzenddocument" onClose={() => setOpen(false)} onSubmit={handleSubmit} loading={loading} error={error}>
          <FormField label="Gekoppelde orderbevestiging">
            <select className={inputClass} value={confirmationId} onChange={(e) => setConfirmationId(e.target.value)}>
              <option value="">— Geen —</option>
              {orderConfirmations.map((oc) => (
                <option key={oc.id} value={oc.id}>{oc.confirmationNumber}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Verzenddatum">
            <input
              type="date"
              className={inputClass}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </FormField>
          <FormField label="Vervoerder">
            <input
              type="text"
              className={inputClass}
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="bijv. DHL, PostNL, DPD"
            />
          </FormField>
          <FormField label="Track & trace code">
            <input
              type="text"
              className={inputClass}
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="Trackingnummer"
            />
          </FormField>
          <FormField label="Opmerkingen">
            <textarea
              className={`${inputClass} h-20 resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionele notities..."
            />
          </FormField>
        </CreateModal>
      )}
    </>
  );
}
