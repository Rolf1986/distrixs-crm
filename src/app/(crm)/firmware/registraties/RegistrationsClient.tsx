"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, Trash2, X } from "lucide-react";

export interface RegistrationRow {
  id: string;
  email: string;
  name: string | null;
  companyName: string | null;
  serialNumber: string | null;
  status: "PENDING" | "ACTIVE" | "UNSUBSCRIBED";
  source: "MANUAL" | "INVOICE" | "SELF";
  productLabel: string;
  customerId: string | null;
  customerName: string | null;
  contactName: string | null;
  notificationCount: number;
  createdAt: string;
}

const STATUS_STYLE: Record<RegistrationRow["status"], { label: string; className: string }> = {
  PENDING: { label: "Wacht op akkoord", className: "bg-amber-50 text-amber-700 border-amber-200" },
  ACTIVE: { label: "Aangemeld", className: "bg-green-50 text-green-700 border-green-200" },
  UNSUBSCRIBED: { label: "Afgemeld", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

const SOURCE_LABEL: Record<RegistrationRow["source"], string> = {
  MANUAL: "handmatig",
  INVOICE: "uit factuur",
  SELF: "zelf aangemeld",
};

export function RegistrationsClient({ registrations }: { registrations: RegistrationRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALLE" | RegistrationRow["status"]>("ALLE");

  async function setStatus(id: string, status: RegistrationRow["status"]) {
    setBusyId(id);
    await fetch(`/api/firmware/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Deze registratie verwijderen? De klant krijgt dan geen updates meer voor dit product.")) return;
    setBusyId(id);
    await fetch(`/api/firmware/registrations/${id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  const rows = filter === "ALLE" ? registrations : registrations.filter((r) => r.status === filter);
  const pendingCount = registrations.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["ALLE", "PENDING", "ACTIVE", "UNSUBSCRIBED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filter === f
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {f === "ALLE" ? "Alle" : STATUS_STYLE[f].label}
            {f === "PENDING" && pendingCount > 0 && (
              <span className="ml-1.5 text-xs opacity-70">({pendingCount})</span>
            )}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Geen registraties in deze weergave. Vink klanten aan op hun klantkaart, tabblad Firmware.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Klant / ontvanger</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Mails</th>
                <th className="px-4 py-3 font-medium text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const style = STATUS_STYLE[r.status];
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.productLabel}</div>
                      {r.serialNumber && <div className="text-xs text-slate-400">s/n {r.serialNumber}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900">
                        {r.customerId ? (
                          <Link href={`/customers/${r.customerId}/firmware`} className="hover:text-blue-700">
                            {r.customerName}
                          </Link>
                        ) : (
                          (r.companyName ?? "—")
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.contactName ?? r.name ?? ""} {r.email}
                        <span className="text-slate-400"> · {SOURCE_LABEL[r.source]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${style.className}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.notificationCount || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {busyId === r.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        {r.status !== "ACTIVE" && (
                          <button
                            onClick={() => setStatus(r.id, "ACTIVE")}
                            disabled={busyId === r.id}
                            title="Aanzetten — klant krijgt voortaan automatisch bericht"
                            className="p-1.5 rounded-md text-green-600 hover:bg-green-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {r.status === "ACTIVE" && (
                          <button
                            onClick={() => setStatus(r.id, "UNSUBSCRIBED")}
                            disabled={busyId === r.id}
                            title="Uitzetten"
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => remove(r.id)}
                          disabled={busyId === r.id}
                          title="Verwijderen"
                          className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
