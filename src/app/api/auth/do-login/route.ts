import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession, sessionCookieOptions } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    if (!email || !password) {
      return NextResponse.redirect(new URL("/login?error=missing", req.url));
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return NextResponse.redirect(new URL("/login?error=invalid", req.url));
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.redirect(new URL("/login?error=invalid", req.url));
    }

    const token = await createSession(user.id);
    const opts = sessionCookieOptions(token);
    const response = NextResponse.redirect(new URL("/dashboard", req.url));
    response.cookies.set(opts.name, opts.value, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      path: opts.path,
      maxAge: opts.maxAge,
      sameSite: opts.sameSite,
    });
    return response;
  } catch (err) {
    console.error("[do-login]", err);
    return NextResponse.redirect(new URL("/login?error=server", req.url));
  }
}
