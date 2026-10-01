import { prisma } from "@/lib/prisma";
import { refreshTokens } from "@/lib/teamleader";
import { decryptSecret, encryptSecret, needsEncryption } from "@/lib/crypto";

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
    const tokens = await refreshTokens(decryptSecret(teamleader_refresh_token)!);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.$executeRaw`
      UPDATE company_settings SET
        teamleader_access_token     = ${encryptSecret(tokens.access_token)},
        teamleader_refresh_token    = ${encryptSecret(tokens.refresh_token)},
        teamleader_token_expires_at = ${expiresAt},
        updated_at                  = NOW()
      WHERE id = 'singleton'
    `;
    return tokens.access_token;
  }

  // Lazy migratie (PRIV-01): nog-plaintext tokens versleuteld terugschrijven
  if (needsEncryption(teamleader_access_token)) {
    await prisma.$executeRaw`
      UPDATE company_settings SET
        teamleader_access_token  = ${encryptSecret(teamleader_access_token)},
        teamleader_refresh_token = ${teamleader_refresh_token ? encryptSecret(teamleader_refresh_token) : null}
      WHERE id = 'singleton'
    `.catch(() => {});
  }

  return decryptSecret(teamleader_access_token)!;
}
