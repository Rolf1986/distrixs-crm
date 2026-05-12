import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const OTP_EXPIRY_MINUTES = 10;

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createOtp(userId: string): Promise<string> {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");

  // Verwijder oude OTP's voor deze gebruiker
  await prisma.otpToken.deleteMany({ where: { userId } });

  await prisma.otpToken.create({
    data: { userId, codeHash, expiresAt },
  });

  return code;
}

export async function verifyOtp(userId: string, code: string): Promise<boolean> {
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const token = await prisma.otpToken.findFirst({
    where: {
      userId,
      codeHash,
      expiresAt: { gt: new Date() },
    },
  });

  if (!token) return false;

  // Gebruik OTP maar één keer
  await prisma.otpToken.delete({ where: { id: token.id } });
  return true;
}
