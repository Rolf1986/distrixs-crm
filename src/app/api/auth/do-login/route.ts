import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession, sessionCookieOptions } from "@/lib/session";

function siteUrl(req: NextRequest, path: string): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "crm.distrixs.nl";
  return `${proto}://${host}${path}`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    if (!email || !password) {
      return NextResponse.redirect(siteUrl(req, "/login?error=missing"));
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return NextResponse.redirect(siteUrl(req, "/login?error=invalid"));
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.redirect(siteUrl(req, "/login?error=invalid"));
    }

    const token = await createSession(user.id);
    const opts = sessionCookieOptions(token);
    const response = NextResponse.redirect(siteUrl(req, "/dashboard"));
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
    return NextResponse.redirect(siteUrl(req, "/login?error=server"));
  }
}
