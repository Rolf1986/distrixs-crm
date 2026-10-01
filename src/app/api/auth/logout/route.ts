import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { logAudit, clientIpFromRequest } from "@/lib/audit";

// Uitloggen: wist het sessie-cookie
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (session?.user?.id) {
    await logAudit({
      userId: session.user.id,
      action: "login.logout",
      entityType: "User",
      entityId: session.user.id,
      ip: clientIpFromRequest(req),
    });
  }

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
