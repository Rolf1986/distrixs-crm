import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOtp } from "@/lib/otp";
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

    const otp = await createOtp(user.id);

    // In productie: verstuur via Resend
    // Voor nu: log naar console
    console.log(`OTP voor ${email}: ${otp}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("request-otp error:", error);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}
