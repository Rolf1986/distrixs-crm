import { NextResponse } from "next/server";

// Uitloggen: wist het sessie-cookie
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("crm-session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
