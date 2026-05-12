"use client";

import { useState } from "react";
import { Navigation, RefreshCw, Plus, ExternalLink, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

function buildTrackingUrl(trackingCode: string, postalCode?: string): string {
  const base = "https://myparcel.me/track-trace";
  const postal = postalCode?.replace(/\s+/g, "") ?? "";
  if (postal) return `${base}/${trackingCode}/${postal}/NL`;
  return `${base}/${trackingCode}`;
}

export type ShipmentRow = {
  id: string;
  myParcelShipmentId: string | null;
  trackingCode: string | null;
  carrier: string | null;
  status: string;
  statusLabel: string | null;
  lastCheckedAt: string | null;
  estimatedDelivery: string | null;
  createdAt: string;
  customerId: string | null;
  customerName: string | null;
  dealId: string | null;
  dealNumber: string | null;
  deliveryNoteId: string | null;
  deliveryNumber: string | null;
};

type CustomerOption = { id: string; companyName: string };
type DeliveryNoteOption = { id: string; deliveryNumber: string };

const STATUS_LABELS: Record<string, string> = {
  PENDING:    "Aangemeld",
  IN_TRANSIT: "Onderweg",
  DELIVERED:  "Afgeleverd",
  RETURN:     "Retour",
  CANCELLED:  "Geannuleerd",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:    "bg-slate-100 text-slate-600",
  IN_TRANSIT: "bg-blue-100 text-blue-700",
  DELIVERED:  "bg-green-100 text-green-700",
  RETURN:     "bg-orange-100 text-orange-700",
  CANCELLED:  "bg-red-100 text-red-700",
};

function StatusBadge({ status, label }: { status: string; label: string | null }) {
  const colorClass = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600";
  const displayLabel = label ?? STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
    >
      {displayLabel}
    </span>
  );
}

const CARRIERS = ["PostNL", "DHL", "DPD", "Other"];

type CreateModalProps = {
  customers: CustomerOption[];
  deliveryNotes: DeliveryNoteOption[];
  onClose: () => void;
  onCreated: (shipment: ShipmentRow) => void;
};

function CreateModal({ customers, deliveryNotes, onClose, onCreated }: CreateModalProps) {
  const [myParcelShipmentId, setMyParcelShipmentId] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [carrier, setCarrier] = useState("PostNL");
  const [customerId, setCustomerId] = useState("");
  const [deliveryNoteId, setDeliveryNoteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myParcelShipmentId: myParcelShipmentId || null,
          trackingCode: trackingCode || null,
          carrier: carrier || null,
          customerId: customerId || null,
          deliveryNoteId: deliveryNoteId || null,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Onbekende fout");
        return;
      }

      const created = await res.json();
      // Fetch full row for the table
      const rowRes = await fetch(`/api/shipments/${created.id}`);
      if (rowRes.ok) {
        const row = await rowRes.json();
        onCreated({
          id: row.id,
          myParcelShipmentId: row.myParcelShipmentId,
          trackingCode: row.trackingCode,
          carrier: row.carrier,
          status: row.status,
          statusLabel: row.statusLabel,
          lastCheckedAt: row.lastCheckedAt,
          estimatedDelivery: row.estimatedDelivery,
          createdAt: row.createdAt,
          customerId: row.customerId,
          customerName: row.customer?.companyName ?? null,
          dealId: row.dealId,
          dealNumber: row.deal?.dealNumber ?? null,
          deliveryNoteId: row.deliveryNoteId,
          deliveryNumber: row.deliveryNote?.deliveryNumber ?? null,
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Nieuwe zending</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              MyParcel zending-ID
            </label>
            <input
              type="text"
              value={myParcelShipmentId}
              onChange={(e) => setMyParcelShipmentId(e.target.value)}
              placeholder="bijv. 12345678"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Trackingnummer
            </label>
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="bijv. 3SDEVC123456789"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Vervoerder
            </label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Klant
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Selecteer klant —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Leveringsbon
            </label>
            <select
              value={deliveryNoteId}
              onChange={(e) => setDeliveryNoteId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Selecteer leveringsbon —</option>
              {deliveryNotes.map((dn) => (
                <option key={dn.id} value={dn.id}>{dn.deliveryNumber}</option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
              style={{ backgroundColor: "#0170B9" }}
            >
              {loading ? "Opslaan…" : "Aanmaken"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type Props = {
  initialShipments: ShipmentRow[];
  customers: CustomerOption[];
  deliveryNotes: DeliveryNoteOption[];
  hasApiKey: boolean;
};

export function ShipmentsClient({
  initialShipments,
  customers,
  deliveryNotes,
  hasApiKey,
}: Props) {
  const [shipments, setShipments] = useState<ShipmentRow[]>(initialShipments);
  const [showModal, setShowModal] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = shipments.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.trackingCode ?? "").toLowerCase().includes(q) ||
      (s.carrier ?? "").toLowerCase().includes(q) ||
      (s.customerName ?? "").toLowerCase().includes(q) ||
      (s.dealNumber ?? "").toLowerCase().includes(q) ||
      (s.deliveryNumber ?? "").toLowerCase().includes(q)
    );
  });

  async function refreshAll() {
    setRefreshingAll(true);
    try {
      await fetch("/api/shipments/refresh-all", { method: "POST" });
      // Reload full list
      const res = await fetch("/api/shipments");
      if (res.ok) {
        const data = await res.json();
        setShipments(data);
      }
    } finally {
      setRefreshingAll(false);
    }
  }

  async function refreshOne(id: string) {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/shipments/${id}/refresh`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setShipments((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: updated.status,
                  statusLabel: updated.statusLabel,
                  trackingCode: updated.trackingCode,
                  estimatedDelivery: updated.estimatedDelivery,
                  lastCheckedAt: updated.lastCheckedAt,
                }
              : s
          )
        );
      }
    } finally {
      setRefreshingId(null);
    }
  }

  function handleCreated(shipment: ShipmentRow) {
    setShipments((prev) => [shipment, ...prev]);
  }

  return (
    <div className="space-y-4">
      {!hasApiKey && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
          <strong>Geen API key:</strong> Stel <code className="font-mono">MYPARCEL_API_KEY</code> in als omgevingsvariabele om automatisch statussen op te halen.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoeken op trackingnummer, klant, deal…"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={refreshingAll || !hasApiKey}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingAll ? "animate-spin" : ""}`} />
            Alle vernieuwen
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: "#0170B9" }}
          >
            <Plus className="w-4 h-4" />
            Nieuwe zending
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center">
          <Navigation className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-medium">Geen zendingen gevonden</p>
          <p className="text-slate-400 text-xs mt-1">
            Maak een nieuwe zending aan via de knop rechtsboven.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                  Trackingnummer
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                  Vervoerder
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                  Klant
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                  Deal / Leveringsbon
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                  Geschatte levering
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const trackingUrl =
                  s.trackingCode ? buildTrackingUrl(s.trackingCode) : null;
                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {s.trackingCode ? (
                        <span className="flex items-center gap-1.5">
                          {s.trackingCode}
                          {trackingUrl && (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700"
                              title="Traceer op MyParcel"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.carrier ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {s.customerName ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                      {s.dealNumber || s.deliveryNumber ? (
                        <span>
                          {s.dealNumber && <span className="text-slate-700">{s.dealNumber}</span>}
                          {s.dealNumber && s.deliveryNumber && " · "}
                          {s.deliveryNumber && <span>{s.deliveryNumber}</span>}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} label={s.statusLabel} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {s.estimatedDelivery
                        ? formatDate(new Date(s.estimatedDelivery))
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => refreshOne(s.id)}
                        disabled={
                          refreshingId === s.id ||
                          !hasApiKey ||
                          !s.myParcelShipmentId ||
                          s.status === "DELIVERED"
                        }
                        title="Status vernieuwen"
                        className="inline-flex items-center text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${refreshingId === s.id ? "animate-spin" : ""}`}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CreateModal
          customers={customers}
          deliveryNotes={deliveryNotes}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
