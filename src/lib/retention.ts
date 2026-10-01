import { prisma } from "@/lib/prisma";

// AVG-opslagbeperking (PRIV-03/04/12): niets groeit meer eeuwig. Termijnen
// zijn bewuste keuzes — financiële documenten (facturen, offertes, betalingen)
// vallen hier NIET onder: die blijven 7 jaar per fiscale bewaarplicht en
// worden nooit automatisch opgeruimd.
export const RETENTION = {
  /** Volledige IMAP-mailkopieën: 2 jaar na ontvangst/verzending */
  emailsMonths: 24,
  /** Via het CRM verzonden mails (bodies): 2 jaar; het feit dát een factuur is gemaild blijft via InvoiceEmail */
  sentEmailsMonths: 24,
  /** Webshop-gedragsdata: 14 maanden (GA-conventie) */
  analyticsMonths: 14,
  /** Auditlog: 2 jaar */
  auditLogMonths: 24,
  /** Afgeronde/afgewezen retouren: 2 jaar na laatste wijziging */
  rmaMonths: 24,
  /** Niet-geconverteerde leads: 2 jaar na laatste wijziging (geconverteerde leads horen bij de klant) */
  leadMonths: 24,
} as const;

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

export async function runRetentionCleanup(): Promise<Record<string, number>> {
  const emails = await prisma.email.deleteMany({
    where: { sentAt: { lt: monthsAgo(RETENTION.emailsMonths) } },
  });

  const sentEmails = await prisma.sentEmail.deleteMany({
    where: { sentAt: { lt: monthsAgo(RETENTION.sentEmailsMonths) } },
  });

  // Sessions/visitors cascaden mee waar events verdwijnen? Nee: events hangen
  // onder sessions — we ruimen op event-niveau en daarna lege sessies/visitors.
  const analyticsEvents = await prisma.analyticsEvent.deleteMany({
    where: { occurredAt: { lt: monthsAgo(RETENTION.analyticsMonths) } },
  });
  const analyticsSessions = await prisma.analyticsSession.deleteMany({
    where: { events: { none: {} }, startedAt: { lt: monthsAgo(RETENTION.analyticsMonths) } },
  });
  const analyticsVisitors = await prisma.analyticsVisitor.deleteMany({
    where: { events: { none: {} }, sessions: { none: {} } },
  });

  const auditLogs = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: monthsAgo(RETENTION.auditLogMonths) } },
  });

  const rmas = await prisma.rma.deleteMany({
    where: {
      status: { in: ["RESOLVED", "REJECTED", "CLOSED"] },
      updatedAt: { lt: monthsAgo(RETENTION.rmaMonths) },
    },
  });

  const leads = await prisma.lead.deleteMany({
    where: {
      convertedToCustomerId: null,
      updatedAt: { lt: monthsAgo(RETENTION.leadMonths) },
    },
  });

  return {
    emails: emails.count,
    sentEmails: sentEmails.count,
    analyticsEvents: analyticsEvents.count,
    analyticsSessions: analyticsSessions.count,
    analyticsVisitors: analyticsVisitors.count,
    auditLogs: auditLogs.count,
    rmas: rmas.count,
    leads: leads.count,
  };
}
