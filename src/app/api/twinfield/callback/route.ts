import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchAndStoreCluster } from "@/lib/twinfield";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    const msg = error ?? "Geen authorization code ontvangen";
    return NextResponse.redirect(
      `${req.nextUrl.origin}/settings/twinfield?error=${encodeURIComponent(msg)}`
    );
  }

  try {
    const tokens = await exchangeCode(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Sla tokens op
    await prisma.$executeRaw`
      UPDATE company_settings SET
        twinfield_access_token = ${tokens.access_token},
        twinfield_refresh_token = ${tokens.refresh_token},
        twinfield_token_expires_at = ${expiresAt}
      WHERE id = 'singleton'
    `;

    // Haal cluster URL op via token validation en sla op in DB
    await fetchAndStoreCluster(tokens.access_token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Onbekende fout";
    console.error("[twinfield] OAuth callback error:", err);
    return NextResponse.redirect(
      `${req.nextUrl.origin}/settings/twinfield?error=${encodeURIComponent(msg)}`
    );
  }

  return NextResponse.redirect(
    `${req.nextUrl.origin}/settings/twinfield?connected=true`
  );
}
