/**
 * Eenvoudige AES-256-CTR encryptie voor IMAP wachtwoorden.
 * Sleutel komt uit ENCRYPTION_KEY env var (32 bytes hex).
 * Fallback: base64 (onveilig, alleen voor development).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY_HEX = process.env.ENCRYPTION_KEY;
const ALG = "aes-256-ctr";

function getKey(): Buffer | null {
  if (!KEY_HEX || KEY_HEX.length < 64) return null;
  return Buffer.from(KEY_HEX.slice(0, 64), "hex");
}

export function encryptPassword(plaintext: string): string {
  const key = getKey();
  if (!key) {
    // Geen key → base64 (dev fallback)
    return "b64:" + Buffer.from(plaintext).toString("base64");
  }
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return "enc:" + iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptPassword(stored: string): string {
  if (stored.startsWith("b64:")) {
    return Buffer.from(stored.slice(4), "base64").toString("utf8");
  }
  if (stored.startsWith("enc:")) {
    const key = getKey();
    if (!key) throw new Error("ENCRYPTION_KEY niet ingesteld");
    const [, ivHex, dataHex] = stored.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = createDecipheriv(ALG, key, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  }
  // Legacy: plaintext
  return stored;
}
