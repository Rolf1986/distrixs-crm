"use client";

import { useState } from "react";
import { Navigation, Plus, RefreshCw, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";

type ShipmentRow = {
  id: string;
  trackingCode: string | null;
  carrier: string | null;
  status: string;
  statusLabel: string | null;
  estimatedDelivery: string | null;
  deliveryNoteId: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:    "bg-slate-100 text-slate-600",
  IN_TRANSIT: "bg-blue-100 text-blue-700",
  DELIVERED:  "bg-green-100 text-green-700",
  RETURN:     "bg-orange-100 text-orange-700",
  CANCELLED:  "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:    "Aangemeld",
  IN_TRANSIT: "Onderweg",
  DELIVERED:  "Afgeleverd",
  RETURN:     "Retour",
  CANCELLED:  "Geannuleerd",
};

function buildTrackingUrl(trackingCode: string): string {
  return `https://myparcel.me/track-trace/${trackingCode}`;
}

type Props = {
  dealId: string;
  customerId: string;
  initialShipments: ShipmentRow[];
  deliveryNoteOptions: { id: string; deliveryNumber: string }[];
};

export function DeliveryNoteShipmentsSection({
  dealId,
  customerId,
  initialShipments,
  deliveryNoteOptions,
}: Props) {
  const [shipments, setShipments] = useState<ShipmentRow[]>(initialShipments);
  const [showForm, setShowForm] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");
  const [myParcelShipmentId, setMyParcelShipmentId] = useState("");
  const [carrier, setCarrier] = useState("PostNL");
  const [deliveryNoteId, setDeliveryNoteId] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingCode: trackingCode || null,
          myParcelShipmentId: myParcelShipmentId || null,
          carrier: carrier || null,
          customerId,
          dealId,
          deliveryNoteId: deliveryNoteId || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setShipments((prev) => [
          {
            id: created.id,
            trackingCode: created.trackingCode,
            carrier: carrier || null,
            status: "PENDING",
            statusLabel: "Aangemeld",
            estimatedDelivery: null,
            deliveryNoteId: deliveryNoteId || null,
          },
          ...prev,
        ]);
        setShowForm(false);
        setTrackingCode("");
        setMyParcelShipmentId("");
        setDeliveryNoteId("");
      }
    } finally {
      setSaving(false);
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
                }
              : s
          )
        );
      }
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Zendingen ({shipments.length})
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          <Plus className="w-3 h-3" />
          Zending koppelen
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-3 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                MyParcel ID
              </label>
              <input
                type="text"
                value={myParcelShipmentId}
                onChange={(e) => setMyParcelShipmentId(e.target.value)}
                placeholder="bijv. 12345678"
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Vervoerder
              </label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {["PostNL", "DHL", "DPD", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
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
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Selecteer —</option>
                {deliveryNoteOptions.map((dn) => (
                  <option key={dn.id} value={dn.id}>{dn.deliveryNumber}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-100"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-white rounded disabled:opacity-60"
              style={{ backgroundColor: "#0170B9" }}
            >
              {saving ? "Opslaan…" : "Koppelen"}
            </button>
          </div>
        </form>
      )}

      {shipments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-6 text-center">
          <Navigation className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
          <p className="text-slate-400 text-xs">Nog geen zendingen gekoppeld</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs uppercase tracking-wide">Trackingnummer</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs uppercase tracking-wide">Vervoerder</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs uppercase tracking-wide">Geschatte levering</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {shipments.map((s) => {
                const colorClass = STATUS_COLORS[s.status] ?? "bg-slate-100 text-slate-600";
                const displayLabel = s.statusLabel ?? STATUS_LABELS[s.status] ?? s.status;
                const trackingUrl = s.trackingCode ? buildTrackingUrl(s.trackingCode) : null;
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">
                      {s.trackingCode ? (
                        <span className="flex items-center gap-1">
                          {s.trackingCode}
                          {trackingUrl && (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-600"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs">
                      {s.carrier ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                        {displayLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs">
                      {s.estimatedDelivery
                        ? formatDate(new Date(s.estimatedDelivery))
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => refreshOne(s.id)}
                        disabled={refreshingId === s.id || s.status === "DELIVERED"}
                        title="Status vernieuwen"
                        className="text-slate-300 hover:text-blue-500 disabled:opacity-30"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${refreshingId === s.id ? "animate-spin" : ""}`}
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
    </div>
  );
}
