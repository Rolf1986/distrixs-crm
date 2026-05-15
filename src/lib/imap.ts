/**
 * IMAP sync service voor Distrixs CRM
 *
 * Verbindt met een IMAP-server, haalt recente e-mails op en slaat ze op.
 * Auto-koppeling aan klanten op basis van e-mailadres.
 *
 * Gebruik: syncEmailAccount(accountId)
 */

import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/crypto";

interface ParsedEmail {
  messageId: string;
  uid: number;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bodyText: string | null;
  snippet: string | null;
  sentAt: Date;
  direction: "INBOUND" | "OUTBOUND";
}

/** Haalt het e-mailadres op uit een "Naam <email>" string */
function extractEmail(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return (match ? match[1] : addr).toLowerCase().trim();
}

function extractName(addr: string): string | null {
  const match = addr.match(/^([^<]+)</);
  return match ? match[1].trim().replace(/"/g, "") : null;
}

/** Kort de bodytekst in tot een snippet */
function makeSnippet(text: string | null): string | null {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

const GENERIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "hotmail.nl", "live.com", "live.nl",
  "yahoo.com", "yahoo.nl", "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me", "tutanota.com",
  "ziggo.nl", "kpn.nl", "xs4all.nl", "hetnet.nl", "planet.nl",
]);

/** Zoek klant op basis van één of meer e-mailadressen (geprioriteerd: exact → domain) */
async function findCustomerByEmails(addresses: string[]): Promise<string | null> {
  const cleaned = addresses.map(a => a.toLowerCase().trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  // 1. Exacte match op contactpersoon-email (hoogste prioriteit)
  const contact = await prisma.customerContact.findFirst({
    where: { email: { in: cleaned, mode: "insensitive" } },
    select: { customerId: true },
  });
  if (contact) return contact.customerId;

  // 2. Domein-match — alleen op zakelijke domeinen
  const domains = [...new Set(
    cleaned
      .map(a => a.split("@")[1])
      .filter((d): d is string => !!d && !GENERIC_DOMAINS.has(d))
  )];

  if (domains.length === 0) return null;

  const customerByDomain = await prisma.customer.findFirst({
    where: {
      contacts: {
        some: {
          email: {
            // matcht @domain.tld aan het einde
            in: domains.map(d => `@${d}`).flatMap(suffix =>
              // Prisma heeft geen "endsWith" in in-filter, gebruik contains via OR
              [suffix]
            ),
          },
        },
      },
    },
    select: { id: true },
  });

  // Handmatige fallback met contains per domein
  if (!customerByDomain) {
    for (const domain of domains) {
      const c = await prisma.customer.findFirst({
        where: {
          contacts: {
            some: { email: { contains: `@${domain}`, mode: "insensitive" } },
          },
        },
        select: { id: true },
      });
      if (c) return c.id;
    }
  }

  return customerByDomain?.id ?? null;
}

/** Zoek deal op basis van klant (nieuwste open deal) */
async function findDealByCustomer(customerId: string): Promise<string | null> {
  const deal = await prisma.deal.findFirst({
    where: {
      customerId,
      status: { notIn: ["WON", "LOST"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return deal?.id ?? null;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  linked: number;   // retroactief gekoppeld
  errors: string[];
}

function safeParseJson(json: string): string[] {
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

export async function syncEmailAccount(accountId: string, maxEmails = 200): Promise<SyncResult> {
  const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive) {
    return { synced: 0, skipped: 0, linked: 0, errors: ["Account niet gevonden of inactief"] };
  }

  const result: SyncResult = { synced: 0, skipped: 0, linked: 0, errors: [] };

  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: {
      user: account.username,
      pass: decryptPassword(account.password),
    },
    logger: false,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages ?? 0;
      if (total === 0) {
        return { ...result, linked: 0 };
      }

      // Eerste sync (nog nooit gesynchroniseerd): haal ALLES op
      // Volgende syncs: haal alleen de laatste maxEmails op
      const isFirstSync = !account.lastSyncAt;
      const range = isFirstSync ? `1:${total}` : `${Math.max(1, total - maxEmails + 1)}:${total}`;

      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        bodyParts: ["TEXT"],
      })) {
        try {
          const env = msg.envelope;
          if (!env) continue;

          const msgId = env.messageId ?? `no-id-${msg.uid}`;
          const subject = env.subject ?? "(geen onderwerp)";
          const from = env.from?.[0];
          const fromAddress = from ? extractEmail(from.address ?? "") : account.username;
          const fromName = from ? extractName(`${from.name ?? ""} <${from.address ?? ""}>`) : null;
          const toAddrs = (env.to ?? []).map(a => a.address ?? "").filter(Boolean);
          const ccAddrs = (env.cc ?? []).map(a => a.address ?? "").filter(Boolean);
          const sentAt = env.date ?? new Date();

          // Richting: uitgaand als from = account username
          const direction: "INBOUND" | "OUTBOUND" =
            fromAddress.toLowerCase() === account.username.toLowerCase() ? "OUTBOUND" : "INBOUND";

          // Check al bekend
          const existing = await prisma.email.findUnique({
            where: { accountId_messageId: { accountId, messageId: msgId } },
          });
          if (existing) { result.skipped++; continue; }

          // Haal body op uit bodyParts
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bodyPart = (msg as any).bodyParts?.get("TEXT");
          const bodyText = bodyPart ? Buffer.from(bodyPart).toString("utf-8").slice(0, 10000) : null;

          // Zoek klant — alle relevante adressen meegeven
          // Inbound: from-adres + alle cc's  |  Outbound: alle to's + cc's
          const lookupAddrs = direction === "INBOUND"
            ? [fromAddress, ...ccAddrs]
            : [...toAddrs, ...ccAddrs];
          const customerId = await findCustomerByEmails(lookupAddrs);
          const dealId = customerId ? await findDealByCustomer(customerId) : null;

          await prisma.email.create({
            data: {
              accountId,
              messageId: msgId,
              uid: msg.uid,
              subject,
              fromAddress,
              fromName,
              toAddresses: JSON.stringify(toAddrs),
              ccAddresses: ccAddrs.length > 0 ? JSON.stringify(ccAddrs) : null,
              bodyText,
              snippet: makeSnippet(bodyText),
              sentAt,
              isRead: msg.flags?.has("\\Seen") ?? false,
              direction,
              customerId,
              dealId,
            },
          });
          result.synced++;
        } catch (msgErr) {
          result.errors.push(`UID ${msg.uid}: ${String(msgErr)}`);
        }
      }
    } finally {
      lock.release();
    }

    // Retroactief koppelen: bestaande ongelinkte mails van dit account alsnog matchen
    const unlinked = await prisma.email.findMany({
      where: { accountId, customerId: null },
      select: { id: true, fromAddress: true, toAddresses: true, ccAddresses: true, direction: true },
      take: 500,
    });
    let retroLinked = 0;
    for (const mail of unlinked) {
      const toAddrsRetro = safeParseJson(mail.toAddresses);
      const ccAddrsRetro = safeParseJson(mail.ccAddresses ?? "[]");
      const lookupAddrs = mail.direction === "INBOUND"
        ? [mail.fromAddress, ...ccAddrsRetro]
        : [...toAddrsRetro, ...ccAddrsRetro];
      const customerId = await findCustomerByEmails(lookupAddrs);
      if (customerId) {
        const dealId = await findDealByCustomer(customerId);
        await prisma.email.update({
          where: { id: mail.id },
          data: { customerId, dealId },
        });
        retroLinked++;
      }
    }
    result.linked = retroLinked;

    // Update lastSyncAt
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastSyncAt: new Date() },
    });
  } catch (err) {
    result.errors.push(String(err));
  } finally {
    await client.logout().catch(() => {});
  }

  return result;
}

/** Laad de bodytekst van een specifiek bericht */
export async function fetchEmailBody(accountId: string, uid: number): Promise<string | null> {
  const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
  if (!account) return null;

  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: { user: account.username, pass: decryptPassword(account.password) },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const msg = await client.fetchOne(String(uid), { bodyParts: ["TEXT"] }, { uid: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const part = (msg as any)?.bodyParts?.get("TEXT");
      if (!part) return null;
      const text = Buffer.from(part).toString("utf-8");
      return text.slice(0, 10000); // max 10KB
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
