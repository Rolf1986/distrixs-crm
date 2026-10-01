import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { runRetentionCleanup } from "@/lib/retention";
import { logAudit } from "@/lib/audit";

export const maxDuration = 120;

// AVG-opschoning (PRIV-03): wekelijks via server-cron (x-cron-secret),
// of handmatig door een ingelogde gebruiker.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (!isCron) {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
    }
  }

  const result = await runRetentionCleanup();

  const total = Object.values(result).reduce((s, n) => s + n, 0);
  if (total > 0) {
    await logAudit({
      action: "retention.cleanup",
      entityType: "System",
      entityId: "retention",
      newValue: result,
    });
  }
  console.log(`[retention] opgeschoond:`, result);

  return NextResponse.json({ ok: true, ...result });
}
