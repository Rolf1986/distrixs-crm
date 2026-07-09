/**
 * Eenvoudige in-memory rate limiter (per proces).
 * Voldoende voor één app-container; beschermt login en andere gevoelige
 * endpoints tegen brute force en bots.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Opruimen van verlopen buckets (voorkomt geheugenlek bij veel unieke keys)
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Registreert een poging en geeft aan of die is toegestaan.
 * @param key unieke sleutel, bv. `login:<ip>` of `login:<email>`
 * @param max maximum aantal pogingen binnen het venster
 * @param windowMs venster in milliseconden
 */
export function rateLimit(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  bucket.count++;
  if (bucket.count > max) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** IP van de aanvrager (achter nginx-proxy). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "onbekend";
}
