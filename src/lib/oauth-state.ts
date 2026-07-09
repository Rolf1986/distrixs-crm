import crypto from "crypto";
import type { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CSRF-bescherming voor OAuth-flows: bij het starten zetten we een willekeurige
 * `state` in een httpOnly-cookie; bij de callback moet de `state`-parameter
 * daarmee overeenkomen. Voorkomt dat een aanvaller een eigen account koppelt.
 */

const MAX_AGE_SEC = 10 * 60; // 10 minuten

export function newState(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function setStateCookie(res: NextResponse, cookieName: string, state: string): void {
  res.cookies.set(cookieName, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

/** Controleer de state uit de query tegen het cookie (constant-time). */
export function verifyState(req: NextRequest, cookieName: string, stateParam: string | null): boolean {
  const cookie = req.cookies.get(cookieName)?.value;
  if (!cookie || !stateParam) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(stateParam);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
