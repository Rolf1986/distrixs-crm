"use client";

import { useState } from "react";
import { Mail, ChevronDown, ChevronUp, Link2, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

type EmailItem = {
  id: string;
  subject: string;
  fromName: string | null;
  fromEmail: string;
  date: string;
  snippet: string | null;
  hasBody: boolean;
  uid: number | null;
  accountId: string;
  dealId: string | null;
  dealNumber: string | null;
  dealTitle: string | null;
  customerId: string | null;
  customerName?: string | null;
};

type Props = {
  emails: EmailItem[];
  contextType: "customer" | "deal";
  contextId: string;
};

export function EmailList({ emails, contextType }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string | null>>({});
  const [loadingBody, setLoadingBody] = useState<string | null>(null);

  async function toggleExpand(email: EmailItem) {
    if (expanded === email.id) {
      setExpanded(null);
      return;
    }
    setExpanded(email.id);
    if (email.hasBody && !(email.id in bodies)) {
      setLoadingBody(email.id);
      try {
        const res = await fetch(`/api/emails/${email.id}/body`);
        if (res.ok) {
          const data = await res.json() as { body: string | null };
          setBodies((b) => ({ ...b, [email.id]: data.body }));
        }
      } finally {
        setLoadingBody(null);
      }
    }
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Mail className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">Geen e-mails gevonden</p>
        <p className="text-xs text-slate-400 mt-1">
          E-mails worden automatisch gekoppeld na synchronisatie van je mailbox.
        </p>
        <Link
          href="/settings/email-accounts"
          className="mt-4 text-xs text-brand-blue hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          Mailbox koppelen via Instellingen
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{emails.length} e-mail{emails.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {emails.map((email) => {
          const isOpen = expanded === email.id;
          const body = bodies[email.id];
          const loading = loadingBody === email.id;

          return (
            <div key={email.id}>
              {/* Header row */}
              <button
                onClick={() => toggleExpand(email)}
                className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {email.subject || "(geen onderwerp)"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail}
                      </p>
                      {email.snippet && !isOpen && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{email.snippet}</p>
                      )}
                      {/* Deal / klant badge */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {email.dealId && email.dealNumber && contextType === "customer" && (
                          <Link
                            href={`/deals/${email.dealId}/emails`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-brand-blue bg-brand-blue-light border border-brand-blue/20 px-2 py-0.5 rounded-full hover:bg-brand-blue/10 transition-colors"
                          >
                            <Link2 className="w-3 h-3" />
                            {email.dealNumber}{email.dealTitle ? ` · ${email.dealTitle}` : ""}
                          </Link>
                        )}
                        {email.customerName && contextType === "deal" && (
                          <Link
                            href={`/customers/${email.customerId}/emails`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full hover:bg-slate-200 transition-colors"
                          >
                            {email.customerName}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400">
                      {new Date(email.date).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
              </button>

              {/* Body (expanded) */}
              {isOpen && (
                <div className="px-5 pb-4 border-t border-slate-100 bg-slate-50">
                  {loading ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Laden…
                    </div>
                  ) : body ? (
                    // Inkomende e-mail-HTML in een gesandboxte iframe: geen scripts,
                    // geen toegang tot cookies/sessie (stored-XSS via mail geblokkeerd)
                    <iframe
                      title="E-mailinhoud"
                      sandbox=""
                      srcDoc={body}
                      className="w-full pt-4 border-0 bg-white"
                      style={{ minHeight: "300px" }}
                    />
                  ) : email.snippet ? (
                    <p className="pt-4 text-sm text-slate-600 whitespace-pre-wrap">{email.snippet}</p>
                  ) : (
                    <p className="pt-4 text-sm text-slate-400 italic">Geen berichttekst beschikbaar.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
