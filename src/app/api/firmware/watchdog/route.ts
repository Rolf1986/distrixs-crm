import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { runWatchdog } from "@/lib/firmwareSync";

export const dynamic = "force-dynamic";

/**
 * Bewaking van de dagelijkse firmware-controle. Draait als tweede cron, een paar
 * uur ná de sync, en mailt naar FIRMWARE_ALERT_EMAIL als er iets niet klopt:
 * de laatste geslaagde controle is te oud, de laatste poging mislukte, of er is
 * nog nooit een geslaagde controle geweest.
 *
 * Query: ?hours=30  hoe oud de laatste geslaagde controle mag zijn (standaard 30)
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
  const hoursParam = Number(searchParams.get("hours"));
  const maxAgeHours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : 30;

  const result = await runWatchdog(maxAgeHours);

  // Bewust 200 bij een probleem: de cron logt de JSON, en `curl -f` moet niet
  // afbreken vóór het logregel is weggeschreven.
  return NextResponse.json(result);
}
