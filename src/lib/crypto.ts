/**
 * Versleuteling voor secrets in de database (IMAP-wachtwoorden, API-keys,
 * OAuth-tokens). Sleutel komt uit ENCRYPTION_KEY env var (32 bytes hex).
 *
 * Formaten:
 * - "enc2:" AES-256-GCM (huidig — authenticated, manipulatie wordt gedetecteerd)
 * - "enc:"  AES-256-CTR (legacy, alleen nog ontsleutelen)
 * - "b64:"  base64 dev-fallback (alleen buiten productie)
 * - overig  legacy plaintext: wordt bij lezen doorgelaten zodat bestaande
 *           waarden blijven werken en lazy her-versleuteld kunnen worden
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY_HEX = process.env.ENCRYPTION_KEY;

function getKey(): Buffer | null {
  if (!KEY_HEX || KEY_HEX.length < 64) return null;
  return Buffer.from(KEY_HEX.slice(0, 64), "hex");
}

export function encryptPassword(plaintext: string): string {
  const key = getKey();
  if (!key) {
    // In productie NOOIT base64 (=plaintext) accepteren — fail hard
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY ontbreekt of te kort (64 hex nodig) — secret niet veilig op te slaan");
    }
    // Alleen buiten productie: base64 dev-fallback
    return "b64:" + Buffer.from(plaintext).toString("base64");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "enc2:" + iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptPassword(stored: string): string {
  if (stored.startsWith("b64:")) {
    return Buffer.from(stored.slice(4), "base64").toString("utf8");
  }
  if (stored.startsWith("enc2:")) {
    const key = getKey();
    if (!key) throw new Error("ENCRYPTION_KEY niet ingesteld");
    const [, ivHex, tagHex, dataHex] = stored.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  }
  if (stored.startsWith("enc:")) {
    const key = getKey();
    if (!key) throw new Error("ENCRYPTION_KEY niet ingesteld");
    const [, ivHex, dataHex] = stored.split(":");
    const decipher = createDecipheriv("aes-256-ctr", key, Buffer.from(ivHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  }
  // Legacy: plaintext
  return stored;
}

// Zelfde mechaniek, duidelijkere namen voor API-keys/tokens (PRIV-01)
export const encryptSecret = encryptPassword;

/** Null-veilig ontsleutelen; plaintext legacy-waarden passeren ongewijzigd. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  return decryptPassword(stored);
}

/** True als de waarde nog als plaintext in de database staat (lazy migratie). */
export function needsEncryption(stored: string | null | undefined): boolean {
  return !!stored && !stored.startsWith("enc2:") && !stored.startsWith("enc:") && !stored.startsWith("b64:");
}
