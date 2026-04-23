import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createAndSendOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    // Return success anyway to prevent user enumeration
    return { success: true };
  }

  // Invalidate previous unused codes
  await prisma.otpCode.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateCode();
  const hashed = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minuten

  await prisma.otpCode.create({
    data: { email, code: hashed, expiresAt },
  });

  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV] OTP voor ${email}: ${code}`);
    return { success: true };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Distrixs CRM <noreply@distrixs.nl>",
    to: email,
    subject: "Je inlogcode – Distrixs CRM",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Inlogcode Distrixs CRM</h2>
        <p>Gebruik de onderstaande code om in te loggen. De code is 10 minuten geldig.</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0f172a;
                    background: #f1f5f9; padding: 20px 32px; border-radius: 8px;
                    text-align: center; margin: 24px 0;">
          ${code}
        </div>
        <p style="color: #64748b; font-size: 14px;">
          Heb je niet geprobeerd in te loggen? Dan kun je deze e-mail negeren.
        </p>
      </div>
    `,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return false;
  return bcrypt.compare(password, user.passwordHash);
}
