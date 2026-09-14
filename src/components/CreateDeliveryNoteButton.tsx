"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { CreateModal, FormField, inputClass } from "@/components/ui/CreateModal";

interface Props {
  dealId: string;
  orderConfirmations: { id: string; confirmationNumber: string }[];
  contacts?: { id: string; name: string; isPrimary: boolean }[];
  defaultContactId?: string | null;
}

export function CreateDeliveryNoteButton({ dealId, orderConfirmations, contacts = [], defaultContactId = null }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationId, setConfirmationId] = useState("");
  const [contactId, setContactId] = useState(defaultContactId ?? "");

  // Regelselectie (deelzending): kandidaat-regels van de bron, elk aan te
  // vinken met een eigen aantal
  type CandidateLine = { skuSnapshot: string; titleSnapshot: string; qty: number };
  const [candidates, setCandidates] = useState<CandidateLine[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [linesLoading, setLinesLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLinesLoading(true);
    fetch(`/api/delivery-notes?dealId=${dealId}${confirmationId ? `&confirmationId=${confirmationId}` : ""}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lines: CandidateLine[]) => {
        if (cancelled) return;
        setCandidates(lines);
        const sel: Record<number, boolean> = {};
        const q: Record<number, number> = {};
        lines.forEach((l, i) => { sel[i] = true; q[i] = l.qty; });
        setSelected(sel);
        setQtys(q);
      })
      .finally(() => { if (!cancelled) setLinesLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, confirmationId, dealId]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [carrier, setCarrier] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setConfirmationId("");
    setContactId(defaultContactId ?? "");
    setDeliveryDate("");
    setCarrier("");
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
          contactId: contactId || null,
          confirmationId: confirmationId || null,
          lines: candidates
            .map((l, i) => ({ ...l, qty: qtys[i] ?? l.qty, _sel: selected[i] }))
            .filter((l) => l._sel && l.qty > 0)
            .map(({ skuSnapshot, titleSnapshot, qty }) => ({ skuSnapshot, titleSnapshot, qty })),
          deliveryDate: deliveryDate || null,
          carrier: carrier || null,
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
          <FormField label="Te versturen regels">
            {linesLoading ? (
              <p className="text-xs text-slate-400 py-1">Regels laden…</p>
            ) : candidates.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">Geen regels gevonden bij deze deal.</p>
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {candidates.map((l, i) => (
                  <label key={i} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={!!selected[i]}
                      onChange={(e) => setSelected((p) => ({ ...p, [i]: e.target.checked }))}
                      className="accent-blue-600"
                    />
                    <span className={`flex-1 truncate ${selected[i] ? "text-slate-800" : "text-slate-400"}`} title={l.titleSnapshot}>
                      {l.titleSnapshot}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={qtys[i] ?? l.qty}
                      disabled={!selected[i]}
                      onChange={(e) => setQtys((p) => ({ ...p, [i]: Math.max(1, Number(e.target.value) || 1) }))}
                      onClick={(e) => e.stopPropagation()}
                      className="w-16 text-right rounded border border-slate-200 px-2 py-1 text-sm disabled:opacity-40"
                    />
                    <span className="text-xs text-slate-400 w-10">/ {l.qty}</span>
                  </label>
                ))}
              </div>
            )}
          </FormField>
          {contacts.length > 0 && (
            <FormField label="Contactpersoon (op document en verzendlabel)">
              <select className={inputClass} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">— Geen —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.isPrimary ? " (primair)" : ""}</option>
                ))}
              </select>
            </FormField>
          )}
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
