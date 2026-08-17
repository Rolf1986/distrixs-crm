/**
 * Firmware-sync vanaf de commandline.
 *
 * Gebruik:
 *   npx ts-node --compiler-options '{"module":"CommonJS","baseUrl":".","paths":{"@/*":["src/*"]}}' \
 *     -r tsconfig-paths/register scripts/firmware-sync.ts [--baseline] [--pages=3] [--dry]
 *
 * --baseline  alles inlezen zonder te mailen (eerste vulling, ±102 pagina's)
 * --pages=N   aantal pagina's (0 = alles)
 * --dry       wel bepalen wie mail zou krijgen, niets versturen
 */

import "dotenv/config";
import { syncFirmware } from "@/lib/firmwareSync";
import { prisma } from "@/lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const baseline = args.includes("--baseline");
  const dryRun = args.includes("--dry");
  const pagesArg = args.find((a) => a.startsWith("--pages="));
  const maxPages = pagesArg ? Number(pagesArg.split("=")[1]) : undefined;

  const started = Date.now();
  const result = await syncFirmware({
    trigger: baseline ? "backfill" : "handmatig",
    baseline: baseline ? true : undefined,
    maxPages,
    dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
  console.log(`Duur: ${Math.round((Date.now() - started) / 1000)}s`);

  const [products, releases] = await Promise.all([
    prisma.firmwareProduct.count(),
    prisma.firmwareRelease.count(),
  ]);
  console.log(`In de database: ${products} producten, ${releases} releases.`);

  await prisma.$disconnect();
  process.exit(result.ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
