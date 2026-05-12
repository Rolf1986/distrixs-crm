import { type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/teamleader";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return Response.redirect(
      new URL(`/settings/import?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return Response.redirect(
      new URL("/settings/import?error=missing_code", request.url)
    );
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

    return Response.redirect(
      new URL("/settings/import?connected=true", request.url)
    );
  } catch (err) {
    console.error("Teamleader OAuth callback error:", err);
    return Response.redirect(
      new URL("/settings/import?error=exchange_failed", request.url)
    );
  }
}
