export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SyncButton } from "./SyncButton";
import { Download, Mail, AlertTriangle } from "lucide-react";

async function getData() {
  const [releases, lastRuns, total] = await Promise.all([
    prisma.firmwareRelease.findMany({
      orderBy: [{ releaseDate: "desc" }, { firstSeenAt: "desc" }],
      take: 50,
      include: {
        firmwareProduct: { select: { id: true, name: true, model: true, _count: { select: { registrations: true } } } },
        _count: { select: { notifications: true } },
      },
    }),
    prisma.firmwareSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
    prisma.firmwareRelease.count(),
  ]);
  return { releases, lastRuns, total };
}

export default async function FirmwarePage() {
  const { releases, lastRuns, total } = await getData();

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Nog geen firmware ingelezen</h2>
        <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto leading-relaxed">
          Haal eerst de volledige geschiedenis van de ACME-supportpagina op (±102 pagina&apos;s, ongeveer een
          minuut). Over die bestaande releases gaat géén mail — dat is de nulmeting. Alles wat de fabrikant
          daarna publiceert, wordt wél gemeld aan de klanten die je hebt aangevinkt.
        </p>
        <div className="mt-6 flex justify-center">
          <SyncButton full label="Volledige geschiedenis ophalen" />
        </div>
      </div>
    );
  }

  const failedRun = lastRuns.find((r) => !r.ok);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Laatste releases</h2>
          <p className="text-sm text-slate-500">{total} releases bekend · nieuwste 50 getoond</p>
        </div>
        <SyncButton label="Nu controleren" />
      </div>

      {failedRun && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800">
            <p className="font-medium">De laatste controle is mislukt</p>
            <p className="text-red-700 mt-0.5">{failedRun.error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Versie</th>
              <th className="px-4 py-3 font-medium">Datum</th>
              <th className="px-4 py-3 font-medium">Aangemeld</th>
              <th className="px-4 py-3 font-medium">Verstuurd</th>
              <th className="px-4 py-3 font-medium text-right">Bestand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {releases.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/firmware/producten?product=${r.firmwareProduct.id}`}
                    className="font-medium text-slate-900 hover:text-blue-700"
                  >
                    {r.firmwareProduct.name}
                  </Link>
                  {r.firmwareProduct.model && r.firmwareProduct.model !== r.firmwareProduct.name && (
                    <span className="text-slate-400"> · {r.firmwareProduct.model}</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.version}</td>
                <td className="px-4 py-3 text-slate-500">
                  {r.releaseDate
                    ? r.releaseDate.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{r.firmwareProduct._count.registrations || "—"}</td>
                <td className="px-4 py-3">
                  {r._count.notifications > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-green-700">
                      <Mail className="w-3.5 h-3.5" />
                      {r._count.notifications}
                    </span>
                  ) : r.isBaseline ? (
                    <span className="text-xs text-slate-400">nulmeting</span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={r.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-700"
                    title={r.fileTitle}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Laatste controles</h3>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {lastRuns.map((run) => (
            <div key={run.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {run.startedAt.toLocaleString("nl-NL", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <span className="text-slate-400"> · {run.trigger}</span>
              </span>
              <span className={run.ok ? "text-slate-500" : "text-red-600"}>
                {run.ok
                  ? `${run.pagesFetched} pagina's · ${run.newReleases} nieuw · ${run.notificationsSent} verstuurd`
                  : (run.error ?? "mislukt")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
