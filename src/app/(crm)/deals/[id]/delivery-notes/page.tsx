import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { Truck } from "lucide-react";
import { CreateDeliveryNoteButton } from "@/components/CreateDeliveryNoteButton";
import { DeliveryNoteShipmentsSection } from "./DeliveryNoteShipmentsSection";

async function getDealData(dealId: string) {
  return prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      customerId: true,
      deliveryNotes: {
        include: {
          confirmation: { select: { confirmationNumber: true } },
          shipments: {
            select: {
              id: true,
              trackingCode: true,
              carrier: true,
              status: true,
              statusLabel: true,
              estimatedDelivery: true,
              deliveryNoteId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      orderConfirmations: {
        select: { id: true, confirmationNumber: true },
        orderBy: { createdAt: "desc" },
      },
      shipments: {
        select: {
          id: true,
          trackingCode: true,
          carrier: true,
          status: true,
          statusLabel: true,
          estimatedDelivery: true,
          deliveryNoteId: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export default async function DealDeliveryNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealData(id);
  if (!deal) notFound();

  const notes = deal.deliveryNotes;
  const deliveryNoteOptions = notes.map((dn) => ({
    id: dn.id,
    deliveryNumber: dn.deliveryNumber,
  }));

  // All shipments directly on this deal (including those linked to delivery notes)
  const allShipments = deal.shipments.map((s) => ({
    id: s.id,
    trackingCode: s.trackingCode,
    carrier: s.carrier,
    status: s.status,
    statusLabel: s.statusLabel,
    estimatedDelivery: s.estimatedDelivery?.toISOString() ?? null,
    deliveryNoteId: s.deliveryNoteId,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Verzenddocumenten ({notes.length})
        </h2>
        <CreateDeliveryNoteButton dealId={id} orderConfirmations={deal.orderConfirmations} />
      </div>

      {notes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center">
          <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-medium">Nog geen verzenddocumenten</p>
          <p className="text-slate-400 text-xs mt-1">
            Maak een verzenddocument aan voor de paklijst en verzenddetails.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Nummer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Datum</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Orderbevestiging</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Vervoerder</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Track & trace</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notes.map((dn) => (
                <tr key={dn.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-slate-900">
                    {dn.deliveryNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {dn.deliveryDate ? formatDate(dn.deliveryDate) : formatDate(dn.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {dn.confirmation ? dn.confirmation.confirmationNumber : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {dn.carrier ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                    {dn.trackingCode ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={dn.status} type="dn" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Shipments section */}
      <DeliveryNoteShipmentsSection
        dealId={id}
        customerId={deal.customerId}
        initialShipments={allShipments}
        deliveryNoteOptions={deliveryNoteOptions}
      />
    </div>
  );
}
