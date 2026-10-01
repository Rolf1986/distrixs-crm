import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

// Betalingsinstellingen (Mollie API-key). Keys gaan versleuteld de database
// in (PRIV-01); validatie gebeurt vóór versleuteling.
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = (await req.json()) as { mollieApiKey?: unknown; myparcelApiKey?: unknown };

  // MyParcel-sleutel (los opslaan via raw SQL)
  if (typeof body.myparcelApiKey === "string") {
    const mp = body.myparcelApiKey.trim();
    await prisma.$executeRaw`UPDATE company_settings SET myparcel_api_key = ${mp ? encryptSecret(mp) : null} WHERE id = 'singleton'`;
    if (typeof body.mollieApiKey !== "string") {
      return NextResponse.json({ ok: true, myparcelConfigured: !!mp });
    }
  }

  if (typeof body.mollieApiKey !== "string") {
    return NextResponse.json({ error: "Geen geldige velden" }, { status: 400 });
  }

  const key = body.mollieApiKey.trim();
  if (key && !/^(live|test)_\w+$/.test(key)) {
    return NextResponse.json(
      { error: "Ongeldige Mollie-key — deze begint met live_ of test_" },
      { status: 400 }
    );
  }

  await prisma.companySetting.update({
    where: { id: "singleton" },
    data: { mollieApiKey: key ? encryptSecret(key) : null },
  });

  return NextResponse.json({ ok: true, mode: key ? (key.startsWith("live_") ? "live" : "test") : null });
}
