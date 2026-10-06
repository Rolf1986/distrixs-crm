import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Offerte-aanvragen vanaf distrixs.nl (server-to-server).
 *
 * De website ondertekent elke aanvraag met HMAC-SHA256 over `${timestamp}.${rawBody}`
 * met het gedeelde geheim WEBSITE_INTAKE_SECRET. Zonder geldige handtekening, of met een
 * timestamp die meer dan 5 minuten afwijkt, wordt de aanvraag geweigerd. Het requestId
 * komt terug als Deal.externalId, zodat een herhaalde (of opnieuw afgespeelde) aanvraag
 * nooit een tweede deal oplevert.
 */

export const INTAKE_MAX_BODY_BYTES = 64 * 1024;
const MAX_CLOCK_SKEW_SEC = 300;
const MAX_ITEMS = 50;
const MAX_OPTIONS_PER_ITEM = 30;

export function verifyIntakeSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  if (!secret || secret.length < 32 || !timestampHeader || !signatureHeader) return false;
  if (!/^\d{9,11}$/.test(timestampHeader) || !/^[0-9a-f]{64}$/.test(signatureHeader)) return false;
  if (Math.abs(nowSec - Number(timestampHeader)) > MAX_CLOCK_SKEW_SEC) return false;

  const expected = createHmac("sha256", secret).update(`${timestampHeader}.${rawBody}`).digest();
  const given = Buffer.from(signatureHeader, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type QuoteRequestItem = {
  sku: string | null;
  name: string;
  qty: number;
  productUrl: string | null;
  options: { label: string; value: string }[];
};

export type QuoteRequest = {
  requestId: string;
  wcUserId: number | null;
  contact: { firstName: string; lastName: string; company: string; email: string; phone: string };
  message: string | null;
  items: QuoteRequestItem[];
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Stuurtekens eruit (behalve regeleinden/tab), trimmen, lengte begrenzen.
function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  return t ? t.slice(0, max) : null;
}

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function httpsUrl(v: unknown): string | null {
  const s = text(v, 500);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseQuoteRequest(body: unknown): Result<QuoteRequest> {
  if (!body || typeof body !== "object") return { ok: false, error: "Ongeldige body" };
  const b = body as Record<string, unknown>;

  const requestId = text(b.requestId, 36);
  if (!requestId || !UUID_RE.test(requestId)) return { ok: false, error: "requestId ontbreekt of ongeldig" };

  const c = (b.contact ?? {}) as Record<string, unknown>;
  const contact = {
    firstName: text(c.firstName, 80),
    lastName: text(c.lastName, 80),
    company: text(c.company, 150),
    email: text(c.email, 254)?.toLowerCase() ?? null,
    phone: text(c.phone, 40),
  };
  if (!contact.firstName || !contact.lastName || !contact.company || !contact.phone) {
    return { ok: false, error: "Contactgegevens onvolledig" };
  }
  if (!contact.email || !EMAIL_RE.test(contact.email)) return { ok: false, error: "Ongeldig e-mailadres" };

  const wcUserId =
    typeof b.wcUserId === "number" && Number.isInteger(b.wcUserId) && b.wcUserId > 0 ? b.wcUserId : null;

  if (!Array.isArray(b.items) || b.items.length === 0) return { ok: false, error: "Geen producten" };
  if (b.items.length > MAX_ITEMS) return { ok: false, error: "Te veel producten" };

  const items: QuoteRequestItem[] = [];
  for (const raw of b.items) {
    const it = (raw ?? {}) as Record<string, unknown>;
    const name = text(it.name, 200);
    const qty = Number(it.qty);
    if (!name) return { ok: false, error: "Product zonder naam" };
    if (!Number.isInteger(qty) || qty < 1 || qty > 100000) return { ok: false, error: `Ongeldig aantal bij ${name}` };

    const options: { label: string; value: string }[] = [];
    if (Array.isArray(it.options)) {
      for (const o of it.options.slice(0, MAX_OPTIONS_PER_ITEM)) {
        const label = text((o as Record<string, unknown>)?.label, 120);
        const value = text((o as Record<string, unknown>)?.value, 500);
        if (label && value) options.push({ label, value });
      }
    }
    items.push({ sku: text(it.sku, 100), name, qty, productUrl: httpsUrl(it.productUrl), options });
  }

  return {
    ok: true,
    data: {
      requestId: requestId.toLowerCase(),
      wcUserId,
      contact: contact as QuoteRequest["contact"],
      message: text(b.message, 5000),
      items,
    },
  };
}

/** Telt werkdagen op (za/zo overgeslagen), voor de vervaldatum van de opvolgtaak. */
export function addWorkdays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}
