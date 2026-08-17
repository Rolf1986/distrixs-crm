export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SubscribeForm, type FirmwareProductOption } from "./SubscribeForm";

async function getProducts(): Promise<FirmwareProductOption[]> {
  // Alleen producten waarvoor daadwerkelijk firmware bestaat.
  const products = await prisma.firmwareProduct.findMany({
    where: { isActive: true, releases: { some: {} } },
    select: {
      id: true,
      name: true,
      model: true,
      releases: {
        orderBy: [{ releaseDate: "desc" }, { firstSeenAt: "desc" }],
        take: 1,
        select: { version: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    id: p.id,
    label: p.model && p.model !== p.name ? `${p.name} (${p.model})` : p.name,
    latestVersion: p.releases[0]?.version ?? null,
  }));
}

export default async function FirmwareUpdatesPage() {
  const products = await getProducts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Firmware-updates voor je armatuur</h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          De fabrikant publiceert regelmatig nieuwe firmware, maar kondigt dat nergens aan. Wij houden dat voor
          je bij: meld je hieronder aan en je krijgt automatisch een mail zodra er een nieuwe versie voor jouw
          product klaarstaat — met downloadlink en een korte uitleg van wat er is veranderd.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-600">
          De productlijst wordt op dit moment bijgewerkt. Probeer het later nog eens, of mail ons op{" "}
          <a href="mailto:info@distrixs.nl" className="text-blue-600">
            info@distrixs.nl
          </a>
          .
        </div>
      ) : (
        <SubscribeForm products={products} />
      )}
    </div>
  );
}
