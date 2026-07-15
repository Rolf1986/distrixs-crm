"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, X } from "lucide-react";

interface Props {
  creditNoteId: string;
  creditNoteNumber: string;
  defaultTo?: string;
  emailOptions?: string[];
}

export function SendCreditNoteButton({ creditNoteId, creditNoteNumber, defaultTo = "", emailOptions = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Creditnota ${creditNoteNumber}`);
  const [message, setMessage] = useState("");

  async function handleSend() {
    if (!to.trim()) { setError("E-mailadres verplicht"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/credit-notes/${creditNoteId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc: cc || undefined, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Versturen mislukt"); return; }
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); router.refresh(); }, 1200);
    } catch {
      setError("Netwerkfout — probeer opnieuw");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Send className="w-4 h-4" />
        Versturen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Creditnota versturen</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Aan</label>
                {emailOptions.length > 0 ? (
                  <input
                    list="cn-email-options"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    placeholder="klant@bedrijf.nl"
                  />
                ) : (
                  <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    placeholder="klant@bedrijf.nl"
                  />
                )}
                <datalist id="cn-email-options">
                  {emailOptions.map((e) => <option key={e} value={e} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">CC (optioneel)</label>
                <input value={cc} onChange={(e) => setCc(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Onderwerp</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Bericht (optioneel)</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Laat leeg voor een standaardtekst" className="w-full resize-none border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30" />
              </div>
              {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:border-slate-300 disabled:opacity-50">Annuleren</button>
              <button onClick={handleSend} disabled={loading || sent} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-blue hover:bg-brand-blue-dark text-white disabled:opacity-60">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {sent ? "Verstuurd ✓" : "Versturen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
