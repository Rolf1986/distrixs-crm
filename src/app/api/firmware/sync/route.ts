import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { syncFirmware } from "@/lib/firmwareSync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Draait de firmware-sync. Twee aanroepers:
 *  • de cron op de droplet, met header `x-cron-secret`
 *  • een ingelogde gebruiker die in het CRM op "nu controleren" drukt
 *
 * Query:
 *   ?pages=3     aantal pagina's (0 = alles)
 *   ?baseline=1  alles inlezen zonder te mailen (eerste vulling)
 *   ?dry=1       wel bepalen wie mail zou krijgen, niets versturen
 */
export async function POST(req: NextRequest) {
  const secret = process.env.FIRMWARE_CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  const viaCron = Boolean(secret && provided && provided === secret);

  if (!viaCron) {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pagesParam = searchParams.get("pages");

  const summary = await syncFirmware({
    trigger: viaCron ? "cron" : "handmatig",
    maxPages: pagesParam !== null ? Number(pagesParam) : undefined,
    baseline: searchParams.get("baseline") === "1" ? true : undefined,
    dryRun: searchParams.get("dry") === "1",
  });

  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}
