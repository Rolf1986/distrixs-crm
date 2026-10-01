import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "crm-session";
// SEC-04: 14 dagen i.p.v. 30; gecombineerd met de tokenVersion-check hieronder
// is een sessie bovendien per direct intrekbaar (deactiveren/wachtwoordwissel).
const JWT_EXPIRY = "14d";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

function getCookieFromRequest(req: Request | NextRequest, name: string): string | undefined {
  // NextRequest has a cookies API; plain Request uses Cookie header
  if ("cookies" in req && typeof (req as NextRequest).cookies?.get === "function") {
    return (req as NextRequest).cookies.get(name)?.value;
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function createSession(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  const token = await new SignJWT({ sub: userId, ver: user?.tokenVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecret());
  return token;
}

export async function getSession(
  req?: Request | NextRequest | null
): Promise<{ user: { id: string } } | null> {
  let token: string | undefined;

  if (req) {
    token = getCookieFromRequest(req, COOKIE_NAME);
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value;
  }

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;

    // SEC-04: het JWT alleen is niet genoeg — de gebruiker moet nog actief
    // zijn en de tokenVersion moet kloppen. Zo stopt deactiveren of een
    // wachtwoordwissel álle uitstaande sessies per direct (de proxy blijft de
    // goedkope eerste poort; dit is de DB-gestaafde tweede).
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, tokenVersion: true },
    });
    if (!user?.isActive) return null;
    const tokenVer = typeof payload.ver === "number" ? payload.ver : 0;
    if (tokenVer !== user.tokenVersion) return null;

    return { user: { id: payload.sub } };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax" as const,
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
  };
}
