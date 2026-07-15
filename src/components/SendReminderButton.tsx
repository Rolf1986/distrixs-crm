"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  currentStatus: string;
  defaultTo?: string;
  daysOverdue?: number;
  emailOptions?: Array<{ label: string; email: string }>;
}

export function SendReminderButton({ invoiceId, invoiceNumber, currentStatus, defaultTo = "", daysOverdue = 0, emailOptions = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Betalingsherinnering ${invoiceNumber}`);
  const [message, setMessage] = useState(
    daysOverdue > 0
      ? `Wij verzoeken u vriendelijk de openstaande factuur ${invoiceNumber} zo spoedig mogelijk te voldoen.\n\nDeze factuur is inmiddels ${daysOverdue} dagen na vervaldatum nog niet voldaan. Mocht u al betaald hebben, dan verzoeken wij u dit bericht te negeren.\n\nVoor vragen kunt u contact met ons opnemen.`
      : `Wij verzoeken u vriendelijk de openstaande factuur ${invoiceNumber} tijdig te voldoen.\n\nVoor vragen kunt u contact met ons opnemen.`
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; simulated?: boolean; error?: string } | null>(null);

  // Toon alleen voor niet-betaalde facturen
  if (currentStatus === "PAID" || currentStatus === "CREDITED" || currentStatus === "DRAFT") return null;

  async function send() {
    if (!to.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, subject, message }),
      });
      const data = await res.json() as { ok?: boolean; simulated?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setResult({ ok: false, error: data.error ?? "Fout bij versturen" });
        return;
      }
      setResult({ ok: true, simulated: data.simulated });
      setTimeout(() => { setOpen(false); setResult(null); router.refresh(); }, 2000);
    } finally {
      setSending(false);
    }
  }

  const isOverdue = daysOverdue > 0;

  return (
    <>
      <button
        onClick={() => { setResult(null); setOpen(true); }}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
          isOverdue
            ? "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
        }`}
      >
        <Bell className="w-4 h-4" />
        Herinnering sturen
        {isOverdue && <span className="ml-1 text-xs">+{daysOverdue}d</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Betalingsherinnering</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{invoiceNumber}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Aan *</label>
                {emailOptions.length > 0 && (
                  <select
                    value={emailOptions.some((o) => o.email === to) ? to : ""}
                    onChange={(e) => { if (e.target.value) setTo(e.target.value); }}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                  >
                    <option value="">Kies van klantkaart…</option>
                    {emailOptions.map((o) => (
                      <option key={`${o.label}-${o.email}`} value={o.email}>{o.label} — {o.email}</option>
                    ))}
                  </select>
                )}
                <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="klant@bedrijf.nl" autoFocus={emailOptions.length === 0}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">CC</label>
                <input type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="intern@distrixs.nl"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Onderwerp</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Bericht</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none" />
              </div>
              <p className="text-xs text-slate-400">📎 {invoiceNumber}.pdf wordt als bijlage meegestuurd</p>

              {result?.ok && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {result.simulated ? "Gesimuleerd — herinnering gelogd" : "Herinnering verstuurd"}
                </div>
              )}
              {result?.error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {result.error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
                Annuleren
              </button>
              <button onClick={send} disabled={sending || !to.trim() || !!result?.ok}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                {sending ? "Versturen…" : "Herinnering sturen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
