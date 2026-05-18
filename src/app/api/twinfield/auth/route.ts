import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAuthorizationUrl } from "@/lib/twinfield";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const state = crypto.randomBytes(16).toString("hex");
  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
