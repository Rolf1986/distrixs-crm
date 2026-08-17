export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { KpiCard } from "@/components/ui/KpiCard";
import { TabNav } from "@/components/TabNav";

async function getCounts() {
  const [releases, products, active, pending, lastRun] = await Promise.all([
    prisma.firmwareRelease.count(),
    prisma.firmwareProduct.count(),
    prisma.firmwareRegistration.count({ where: { status: "ACTIVE" } }),
    prisma.firmwareRegistration.count({ where: { status: "PENDING" } }),
    prisma.firmwareSyncRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  return { releases, products, active, pending, lastRun };
}

export default async function FirmwareLayout({ children }: { children: React.ReactNode }) {
  const { releases, products, active, pending, lastRun } = await getCounts();

  const lastRunLabel = lastRun
    ? lastRun.startedAt.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "nog niet gedraaid";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-8 pt-6 pb-5 bg-white border-b border-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">Firmware</h1>
        <p className="text-sm text-slate-500 mt-1">
          Nieuwe firmware van ACME wordt automatisch opgehaald. Klanten die je aanvinkt krijgen vanzelf bericht.
        </p>

        <div className="grid grid-cols-5 gap-3 mt-5">
          <KpiCard label="Releases" value={String(releases)} />
          <KpiCard label="Producten" value={String(products)} />
          <KpiCard label="Aangemeld" value={String(active)} />
          <KpiCard label="Wacht op akkoord" value={String(pending)} />
          <KpiCard label="Laatste controle" value={lastRunLabel} />
        </div>

        <TabNav
          tabs={[
            { label: "Releases", href: "/firmware", exact: true },
            { label: "Producten", href: "/firmware/producten" },
            { label: "Registraties", href: "/firmware/registraties" },
          ]}
        />
      </div>

      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
