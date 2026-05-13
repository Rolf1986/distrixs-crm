import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOtp } from "@/lib/otp";
import { sendEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email en wachtwoord zijn verplicht" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Onjuiste inloggegevens" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Onjuiste inloggegevens" }, { status: 401 });
    }

    let otp: string;
    try {
      otp = await createOtp(user.id);
      console.log(`OTP aangemaakt voor ${email}: ${otp}`);
    } catch (otpErr) {
      console.error("OTP aanmaken mislukt:", otpErr);
      return NextResponse.json({ error: "Interne fout bij OTP aanmaken" }, { status: 500 });
    }

    // Stuur via Resend als API key beschikbaar is
    const emailResult = await sendEmail({
      to: email,
      subject: "Jouw inlogcode – Distrixs CRM",
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:40px auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="margin:0 0 16px 0;color:#1e40af;">Distrixs CRM</h2>
          <p style="color:#374151;">Jouw verificatiecode:</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827;margin:16px 0;font-family:monospace;">${otp}</div>
          <p style="color:#6b7280;font-size:14px;">Deze code is 10 minuten geldig.</p>
        </div>
      `,
    });

    // Als email mislukt (geen RESEND_API_KEY): stuur code in response terug
    // zodat de loginpagina hem kan tonen (intern systeem, één gebruiker)
    if (emailResult.simulated) {
      return NextResponse.json({ success: true, devCode: otp });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("request-otp error:", error);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}
