import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("crm-session")?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Altijd doorlaten
  if (
    pathname === "/track.js" || // publiek analytics-snippet (webshop laadt dit anoniem)
    pathname === "/logo.png" || // logo voor e-mails en PDF's
    pathname === "/sw.js" || // service worker (PWA)
    pathname === "/manifest.webmanifest" || // PWA-manifest
    pathname === "/apple-touch-icon.png" ||
    /^\/icon-[\w-]+\.png$/.test(pathname) || // PWA-iconen
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/retour") ||
    pathname.startsWith("/firmware-updates") || // publieke aanmeld-/afmeldpagina firmware-updates
    pathname === "/api/rma" ||
    pathname.startsWith("/api/rma/") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login" || pathname === "/inloggen";
  const isLoggedIn = await hasValidSession(req);

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
