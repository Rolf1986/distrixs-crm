import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/teamleader";
import { requireUser } from "@/lib/authz";
import { newState, setStateCookie } from "@/lib/oauth-state";

// Start de Teamleader OAuth-flow met CSRF-state. Alleen voor ingelogde gebruikers.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const state = newState();
  const res = NextResponse.redirect(getAuthUrl(state));
  setStateCookie(res, "tl_oauth_state", state);
  return res;
}
