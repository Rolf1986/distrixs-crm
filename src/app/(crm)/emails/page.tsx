import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Mail, RefreshCw, Settings } from "lucide-react";

async function getRecentEmails() {
  return prisma.email.findMany({
    orderBy: { sentAt: "desc" },
    take: 200,
    include: {
      customer: { select: { id: true, companyName: true } },
      deal: { select: { id: true, dealNumber: true, title: true } },
    },
  });
}

async function getAccountCount() {
  return prisma.emailAccount.count({ where: { isActive: true } });
}

export default async function EmailsPage() {
  const [emails, accountCount] = await Promise.all([
    getRecentEmails(),
    getAccountCount(),
  ]);

  const unlinked = emails.filter((e) => !e.customerId && !e.dealId);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">E-mails</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {emails.length} e-mails · {accountCount} actieve mailbox{accountCount !== 1 ? "en" : ""}
              {unlinked.length > 0 && (
                <span className="ml-2 text-amber-600">· {unlinked.length} niet gekoppeld</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings/email-accounts"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:border-slate-300 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Mailboxen beheren
            </Link>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl">
        {accountCount === 0 ? (
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
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {emails.map((email) => (
              <div key={email.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
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
                        {email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {email.customer ? (
                          <Link
                            href={`/customers/${email.customer.id}/emails`}
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
                            className="text-xs text-brand-blue bg-brand-blue-light border border-brand-blue/20 px-2 py-0.5 rounded-full hover:bg-brand-blue/10 transition-colors"
                          >
                            {email.deal.dealNumber} · {email.deal.title}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 mt-1">
                    {new Date(email.sentAt).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
