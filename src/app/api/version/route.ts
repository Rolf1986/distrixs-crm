import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Build-id van de draaiende server. De client (StaleClientGuard) vergelijkt
// dit met de versie waarmee hij geladen is en ververst na een deploy eenmalig
// automatisch — voorkomt "werkt slecht" door verouderde open tabbladen/PWA.
// Bewust publiek: lekt alleen een build-hash, geen data (zie src/proxy.ts /api/).

let buildId = "dev";
try {
  buildId = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
} catch { /* lokaal zonder build */ }

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { buildId },
    { headers: { "Cache-Control": "no-store" } }
  );
}
