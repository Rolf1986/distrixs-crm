"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Mail,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type EmailRow = {
  id: string;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  bodyText: string | null;
  snippet: string | null;
  sentAt: Date | string;
  accountId: string;
  customer: { id: string; companyName: string } | null;
  deal: { id: string; dealNumber: string; title: string } | null;
};

type AccountOption = { id: string; label: string };

type Props = {
  emails: EmailRow[];
  accounts: AccountOption[];
};

const PAGE_SIZE = 50;

export default function EmailsPageClient({ emails, accounts }: Props) {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string | null>>({});
  const [loadingBody, setLoadingBody] = useState<string | null>(null);

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return emails.filter((e) => {
      if (accountFilter !== "all" && e.accountId !== accountFilter) return false;
      if (!q) return true;
      return (
        e.subject.toLowerCase().includes(q) ||
        e.fromAddress.toLowerCase().includes(q) ||
        (e.fromName?.toLowerCase().includes(q) ?? false) ||
        (e.customer?.companyName.toLowerCase().includes(q) ?? false) ||
        (e.deal?.dealNumber.toLowerCase().includes(q) ?? false) ||
        (e.deal?.title.toLowerCase().includes(q) ?? false)
      );
    });
  }, [emails, search, accountFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEmails = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filter/search changes
  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }
  function handleAccountFilter(val: string) {
    setAccountFilter(val);
    setPage(1);
  }

  async function toggleExpand(email: EmailRow) {
    if (expanded === email.id) {
      setExpanded(null);
      return;
    }
    setExpanded(email.id);
    if (!(email.id in bodies)) {
      setLoadingBody(email.id);
      try {
        const res = await fetch(`/api/emails/${email.id}/body`);
        if (res.ok) {
          const data = (await res.json()) as { body: string | null };
          setBodies((b) => ({ ...b, [email.id]: data.body }));
        } else {
          setBodies((b) => ({ ...b, [email.id]: null }));
        }
      } finally {
        setLoadingBody(null);
      }
    }
  }

  const unlinkedCount = emails.filter((e) => !e.customer && !e.deal).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 pt-6 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">E-mails</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {emails.length} e-mails
              {search || accountFilter !== "all" ? (
                <span className="text-brand-blue ml-1">· {filtered.length} resultaten</span>
              ) : null}
              {accounts.length > 0 && (
                <span>
                  {" "}· {accounts.length} actieve mailbox{accounts.length !== 1 ? "en" : ""}
                </span>
              )}
              {unlinkedCount > 0 && (
                <span className="ml-2 text-amber-600">· {unlinkedCount} niet gekoppeld</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/settings/email-accounts"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:border-slate-300 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Mailboxen beheren
            </Link>
          </div>
        </div>

        {/* Search + account filter */}
        {accounts.length > 0 && (
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Zoek op onderwerp, afzender, klant, deal…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
              />
            </div>

            {accounts.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => handleAccountFilter("all")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    accountFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Alle accounts
                </button>
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => handleAccountFilter(acc.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      accountFilter === acc.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-8 py-6 max-w-5xl">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-base font-medium text-slate-700">Nog geen mailbox gekoppeld</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              Koppel je inbox via IMAP om e-mails automatisch te koppelen aan klanten en deals.
            </p>
            <Link
              href="/settings/email-accounts"
              className="mt-5 flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Mailbox koppelen
            </Link>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <RefreshCw className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-base font-medium text-slate-700">Nog geen e-mails gesynchroniseerd</p>
            <p className="text-sm text-slate-400 mt-1">
              Ga naar Instellingen → E-mailboxen en klik op Synchroniseer.
            </p>
            <Link
              href="/settings/email-accounts"
              className="mt-4 text-sm text-brand-blue hover:underline"
            >
              Naar e-mailboxen →
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-base font-medium text-slate-700">Geen resultaten</p>
            <p className="text-sm text-slate-400 mt-1">
              Pas je zoekopdracht aan om resultaten te zien.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {pageEmails.map((email) => {
                const isOpen = expanded === email.id;
                const body = bodies[email.id];
                const loading = loadingBody === email.id;
                const hasBody = !!(email.bodyText || email.snippet);

                return (
                  <div key={email.id}>
                    <button
                      onClick={() => toggleExpand(email)}
                      className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {email.subject || "(geen onderwerp)"}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {email.fromName
                                ? `${email.fromName} <${email.fromAddress}>`
                                : email.fromAddress}
                            </p>
                            {email.snippet && !isOpen && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate">
                                {email.snippet}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {email.customer ? (
                                <Link
                                  href={`/customers/${email.customer.id}/emails`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-full transition-colors"
                                >
                                  {email.customer.companyName}
                                </Link>
                              ) : (
                                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  Niet gekoppeld
                                </span>
                              )}
                              {email.deal && (
                                <Link
                                  href={`/deals/${email.deal.id}/emails`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-brand-blue bg-brand-blue-light border border-brand-blue/20 px-2 py-0.5 rounded-full hover:bg-brand-blue/10 transition-colors"
                                >
                                  {email.deal.dealNumber} · {email.deal.title}
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400">
                            {new Date(email.sentAt).toLocaleDateString("nl-NL", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          {hasBody ? (
                            isOpen ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )
                          ) : null}
                        </div>
                      </div>
                    </button>

                    {/* Expanded body */}
                    {isOpen && (
                      <div className="px-5 pb-4 border-t border-slate-100 bg-slate-50">
                        {loading ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Laden…
                          </div>
                        ) : body ? (
                          <div
                            className="prose prose-sm max-w-none pt-4 text-slate-700 overflow-auto"
                            dangerouslySetInnerHTML={{ __html: body }}
                          />
                        ) : email.snippet ? (
                          <p className="pt-4 text-sm text-slate-600 whitespace-pre-wrap">
                            {email.snippet}
                          </p>
                        ) : (
                          <p className="pt-4 text-sm text-slate-400 italic">
                            Geen berichttekst beschikbaar.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
                <span>
                  {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filtered.length)} van {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
