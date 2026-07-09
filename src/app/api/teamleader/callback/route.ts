import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/teamleader";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { verifyState } from "@/lib/oauth-state";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://crm.distrixs.nl";

export async function GET(request: NextRequest) {
  // Alleen een ingelogde gebruiker mag de koppeling afronden
  const auth = await requireUser(request);
  if (!auth.ok) return NextResponse.redirect(`${BASE_URL}/login`);

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return Response.redirect(
      `${BASE_URL}/settings/import?error=${encodeURIComponent(error)}`
    );
  }

  // CSRF: state uit de callback moet matchen met het cookie
  if (!verifyState(request, "tl_oauth_state", searchParams.get("state"))) {
    return Response.redirect(`${BASE_URL}/settings/import?error=invalid_state`);
  }

  if (!code) {
    return Response.redirect(`${BASE_URL}/settings/import?error=missing_code`);
  }

  try {
    const tokens = await exchangeCode(code);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.$executeRaw`
      INSERT INTO company_settings (id, updated_at, teamleader_access_token, teamleader_refresh_token, teamleader_token_expires_at)
      VALUES ('singleton', NOW(), ${tokens.access_token}, ${tokens.refresh_token}, ${expiresAt})
      ON CONFLICT (id) DO UPDATE SET
        teamleader_access_token     = EXCLUDED.teamleader_access_token,
        teamleader_refresh_token    = EXCLUDED.teamleader_refresh_token,
        teamleader_token_expires_at = EXCLUDED.teamleader_token_expires_at,
        updated_at                  = NOW()
    `;

    return Response.redirect(`${BASE_URL}/settings/import?connected=true`);
  } catch (err) {
    console.error("Teamleader OAuth callback error:", err);
    return Response.redirect(`${BASE_URL}/settings/import?error=exchange_failed`);
  }
}
