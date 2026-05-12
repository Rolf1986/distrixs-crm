import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasApiKey } from "@/lib/myparcel";
import { ShipmentsClient } from "./ShipmentsClient";

async function getShipments() {
  return prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, companyName: true } },
      deal: { select: { id: true, dealNumber: true } },
      deliveryNote: { select: { id: true, deliveryNumber: true } },
    },
  });
}

async function getCustomers() {
  return prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });
}

async function getDeliveryNotes() {
  return prisma.deliveryNote.findMany({
    select: { id: true, deliveryNumber: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export default async function ShipmentsPage() {
  const [shipments, customers, deliveryNotes] = await Promise.all([
    getShipments(),
    getCustomers(),
    getDeliveryNotes(),
  ]);

  const inTransit = shipments.filter((s) => s.status === "IN_TRANSIT").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Zendingen"
        description={`${shipments.length} zendingen · ${inTransit} onderweg`}
      />
      <div className="px-8 py-6">
        <ShipmentsClient
          initialShipments={shipments.map((s) => ({
            id: s.id,
            myParcelShipmentId: s.myParcelShipmentId,
            trackingCode: s.trackingCode,
            carrier: s.carrier,
            status: s.status,
            statusLabel: s.statusLabel,
            lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
            estimatedDelivery: s.estimatedDelivery?.toISOString() ?? null,
            createdAt: s.createdAt.toISOString(),
            customerId: s.customerId,
            customerName: s.customer?.companyName ?? null,
            dealId: s.dealId,
            dealNumber: s.deal?.dealNumber ?? null,
            deliveryNoteId: s.deliveryNoteId,
            deliveryNumber: s.deliveryNote?.deliveryNumber ?? null,
          }))}
          customers={customers}
          deliveryNotes={deliveryNotes}
          hasApiKey={hasApiKey()}
        />
      </div>
    </div>
  );
}
