import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession, sessionCookieOptions } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";

function siteUrl(req: NextRequest, path: string): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "crm.distrixs.nl";
  return `${proto}://${host}${path}`;
}

export async function POST(req: NextRequest) {
  try {
    // Brute force-bescherming: max 10 pogingen per IP en 5 per e-mailadres per 15 min
    const ip = clientIp(req);
    const ipLimit = rateLimit(`login-ip:${ip}`, 10, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.redirect(siteUrl(req, "/login?error=ratelimit"));
    }

    const form = await req.formData();
    const email = (form.get("email") as string)?.trim().toLowerCase();
    const password = form.get("password") as string;

    // Bot-detectie: honeypot ingevuld → stil weigeren (bot denkt dat het lukte)
    const honeypot = (form.get("company_website") as string) ?? "";
    if (honeypot.trim() !== "") {
      return NextResponse.redirect(siteUrl(req, "/login?error=invalid"));
    }
    // Tijd-val: mens doet er langer dan ~2s over; sneller = geautomatiseerd
    const loadedAt = Number(form.get("form_loaded_at"));
    if (Number.isFinite(loadedAt) && Date.now() - loadedAt < 2000) {
      return NextResponse.redirect(siteUrl(req, "/login?error=invalid"));
    }

    // Cloudflare Turnstile: alleen afdwingen als de secret is ingesteld
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      const captchaToken = form.get("cf-turnstile-response") as string;
      if (!captchaToken) {
        return NextResponse.redirect(siteUrl(req, "/login?error=captcha"));
      }
      const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: turnstileSecret, response: captchaToken, remoteip: ip }),
      });
      const outcome = (await verify.json()) as { success?: boolean };
      if (!outcome.success) {
        return NextResponse.redirect(siteUrl(req, "/login?error=captcha"));
      }
    }

    if (!email || !password) {
      return NextResponse.redirect(siteUrl(req, "/login?error=missing"));
    }

    const emailLimit = rateLimit(`login-email:${email}`, 5, 15 * 60 * 1000);
    if (!emailLimit.allowed) {
      return NextResponse.redirect(siteUrl(req, "/login?error=ratelimit"));
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      // Zelfde kosten als een echte wachtwoordcheck: geen user-enumeratie via timing
      await bcrypt.compare(password, "$2a$10$C6UzMDM.H6dfI/f/IKcEeO7Kfp0dpQdWnP0nqOZ7SgdOMSN0nQpGe");
      return NextResponse.redirect(siteUrl(req, "/login?error=invalid"));
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.redirect(siteUrl(req, "/login?error=invalid"));
    }

    const token = await createSession(user.id);
    const opts = sessionCookieOptions(token);
    // 303 See Other: browser gebruikt GET voor de redirect (correct na form POST)
    const response = NextResponse.redirect(siteUrl(req, "/dashboard"), { status: 303 });
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
