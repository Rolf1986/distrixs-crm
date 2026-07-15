import { prisma } from "@/lib/prisma";
import { refreshTokens } from "@/lib/teamleader";

/**
 * Geldig Teamleader access-token ophalen (met refresh vlak voor verval).
 * Gedeeld door de import- en backfill-routes.
 */
export async function getValidAccessToken(): Promise<string> {
  const row = await prisma.$queryRaw<
    Array<{
      teamleader_access_token: string | null;
      teamleader_refresh_token: string | null;
      teamleader_token_expires_at: Date | null;
    }>
  >`
    SELECT teamleader_access_token, teamleader_refresh_token, teamleader_token_expires_at
    FROM company_settings WHERE id = 'singleton'
  `;

  if (!row.length || !row[0].teamleader_access_token) {
    throw new Error("Teamleader niet gekoppeld. Koppel eerst via de importpagina.");
  }

  const { teamleader_access_token, teamleader_refresh_token, teamleader_token_expires_at } = row[0];

  const soon = new Date(Date.now() + 5 * 60 * 1000);
  if (teamleader_token_expires_at && teamleader_token_expires_at < soon && teamleader_refresh_token) {
    const tokens = await refreshTokens(teamleader_refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.$executeRaw`
      UPDATE company_settings SET
        teamleader_access_token     = ${tokens.access_token},
        teamleader_refresh_token    = ${tokens.refresh_token},
        teamleader_token_expires_at = ${expiresAt},
        updated_at                  = NOW()
      WHERE id = 'singleton'
    `;
    return tokens.access_token;
  }

  return teamleader_access_token;
}
