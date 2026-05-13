import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Vereiste velden ontbreken" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Onjuiste gegevens" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Onjuiste gegevens" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    console.error("[login route]", err);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}
