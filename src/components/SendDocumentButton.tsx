"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  type: "quote" | "invoice";
  documentId: string;
  documentNumber: string;
  currentStatus: string;
  defaultTo?: string;
  defaultMessage?: string;
  /** Taal van het document (NL of EN) — bepaalt welke template automatisch geladen wordt */
  documentLanguage?: string;
  /** Bekende e-mailadressen van de klantkaart (hoofdadres + contactpersonen) */
  emailOptions?: Array<{ label: string; email: string }>;
}

type Lang = "NL" | "EN";

const FALLBACK: Record<Lang, Record<"quote" | "invoice", { subject: string; body: string }>> = {
  NL: {
    quote: {
      subject: "Offerte {documentNumber}",
      body: "Hierbij ontvangt u onze offerte {documentNumber}.\n\nVoor vragen kunt u altijd contact met ons opnemen.\n\nMet vriendelijke groet,",
    },
    invoice: {
      subject: "Factuur {documentNumber}",
      body: "Hierbij ontvangt u onze factuur {documentNumber}.\n\nGelieve het bedrag voor de vervaldatum over te maken met als betalingskenmerk het factuurnummer.\n\nMet vriendelijke groet,",
    },
  },
  EN: {
    quote: {
      subject: "Quotation {documentNumber}",
      body: "Please find attached our quotation {documentNumber}.\n\nShould you have any questions, please do not hesitate to contact us.\n\nKind regards,",
    },
    invoice: {
      subject: "Invoice {documentNumber}",
      body: "Please find attached our invoice {documentNumber}.\n\nKindly transfer the amount before the due date, using the invoice number as payment reference.\n\nKind regards,",
    },
  },
};

function applyVars(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{${k}\\}`, "g"), v),
    text
  );
}

export function SendDocumentButton({
  type,
  documentId,
  documentNumber,
  currentStatus,
  defaultTo = "",
  documentLanguage = "NL",
  emailOptions = [],
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>((documentLanguage === "EN" ? "EN" : "NL") as Lang);
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; simulated?: boolean; error?: string } | null>(null);

  const canSend = currentStatus === "DRAFT" || currentStatus === "SENT";
  if (!canSend) return null;

  const label = type === "quote"
    ? (lang === "EN" ? "Send quotation" : "Offerte versturen")
    : (lang === "EN" ? "Send invoice" : "Factuur versturen");

  const apiPath = type === "quote"
    ? `/api/quotes/${documentId}/send`
    : `/api/invoices/${documentId}/send`;

  async function loadTemplate(targetLang: Lang) {
    try {
      const res = await fetch("/api/settings/company");
      if (!res.ok) throw new Error();
      const data = await res.json() as Record<string, string | null>;

      const suffix = targetLang === "EN" ? "En" : "";
      const subjectKey = type === "quote"
        ? `quoteEmailSubject${suffix}`
        : `invoiceEmailSubject${suffix}`;
      const bodyKey = type === "quote"
        ? `quoteEmailBody${suffix}`
        : `invoiceEmailBody${suffix}`;

      const vars = { documentNumber };
      const rawSubject = data[subjectKey] || FALLBACK[targetLang][type].subject;
      const rawBody = data[bodyKey] || FALLBACK[targetLang][type].body;

      setSubject(applyVars(rawSubject, vars));
      setMessage(applyVars(rawBody, vars));
    } catch {
      const vars = { documentNumber };
      setSubject(applyVars(FALLBACK[targetLang][type].subject, vars));
      setMessage(applyVars(FALLBACK[targetLang][type].body, vars));
    }
  }

  function openDialog() {
    const initialLang: Lang = documentLanguage === "EN" ? "EN" : "NL";
    setLang(initialLang);
    setResult(null);
    setOpen(true);
    loadTemplate(initialLang);
  }

  function switchLang(newLang: Lang) {
    setLang(newLang);
    loadTemplate(newLang);
  }

  async function send() {
    if (!to.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(apiPath, {
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

  return (
    <>
      <button
        onClick={openDialog}
        className="flex items-center gap-1.5 px-3 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Send className="w-4 h-4" />
        {type === "quote" ? "Offerte versturen" : "Factuur versturen"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">{label}</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{documentNumber}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Taal-toggle */}
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                  {(["NL", "EN"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => switchLang(l)}
                      className={`px-3 py-1.5 font-medium transition-colors ${
                        lang === l
                          ? "bg-brand-blue text-white"
                          : "text-slate-500 hover:text-slate-700 bg-white border-l border-slate-200 first:border-l-0"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Aan */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  {lang === "EN" ? "To *" : "Aan *"}
                </label>
                {emailOptions.length > 0 && (
                  <select
                    value={emailOptions.some((o) => o.email === to) ? to : ""}
                    onChange={(e) => { if (e.target.value) setTo(e.target.value); }}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                  >
                    <option value="">
                      {lang === "EN" ? "Choose from customer card…" : "Kies van klantkaart…"}
                    </option>
                    {emailOptions.map((o) => (
                      <option key={`${o.label}-${o.email}`} value={o.email}>
                        {o.label} — {o.email}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="contact@company.com"
                  autoFocus={emailOptions.length === 0}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>

              {/* CC */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  CC ({lang === "EN" ? "optional" : "optioneel"})
                </label>
                <input
                  type="email"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="intern@distrixs.nl"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>

              {/* Onderwerp */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  {lang === "EN" ? "Subject" : "Onderwerp"}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>

              {/* Bericht */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  {lang === "EN" ? "Message" : "Bericht"}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none"
                />
              </div>

              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>📎</span>
                {documentNumber}.pdf {lang === "EN" ? "will be attached automatically" : "wordt automatisch als bijlage meegestuurd"}
              </p>

              {result?.ok && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {result.simulated
                    ? (lang === "EN" ? "Simulated (no RESEND_API_KEY) — status updated" : "Gesimuleerd (geen RESEND_API_KEY) — status bijgewerkt")
                    : (lang === "EN" ? "Email sent successfully" : "E-mail succesvol verstuurd")}
                </div>
              )}
              {result?.error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {result.error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                {lang === "EN" ? "Cancel" : "Annuleren"}
              </button>
              <button
                onClick={send}
                disabled={sending || !to.trim() || !!result?.ok}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? (lang === "EN" ? "Sending…" : "Versturen…") : (lang === "EN" ? "Send" : "Versturen")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
