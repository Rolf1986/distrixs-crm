import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/twinfield";
import { prisma } from "@/lib/prisma";

const CLUSTER = process.env.TWINFIELD_CLUSTER ?? "accounting.twinfield.com";

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

    // Try to get office code from Twinfield organisations API
    let officeCode = "";
    try {
      const orgRes = await fetch(`https://${CLUSTER}/api/v1/organisations`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (orgRes.ok) {
        const orgData = (await orgRes.json()) as unknown;
        // Twinfield returns array of organisations with officeCodes
        if (Array.isArray(orgData) && orgData.length > 0) {
          const first = orgData[0] as Record<string, unknown>;
          officeCode =
            (first.shortName as string) ??
            (first.code as string) ??
            (first.officeCode as string) ??
            "";
        }
      }
    } catch (orgErr) {
      // Non-fatal: user can set office code manually
      console.warn("[twinfield] Could not fetch organisation code:", orgErr);
    }

    await prisma.$executeRaw`
      UPDATE company_settings SET
        twinfield_access_token = ${tokens.access_token},
        twinfield_refresh_token = ${tokens.refresh_token},
        twinfield_token_expires_at = ${expiresAt},
        twinfield_office_code = CASE
          WHEN ${officeCode} <> '' THEN ${officeCode}
          ELSE twinfield_office_code
        END
      WHERE id = 'singleton'
    `;
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
