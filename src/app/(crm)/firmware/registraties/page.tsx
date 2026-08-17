export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { RegistrationsClient, type RegistrationRow } from "./RegistrationsClient";

export default async function FirmwareRegistrationsPage() {
  const registrations = await prisma.firmwareRegistration.findMany({
    include: {
      firmwareProduct: { select: { name: true, model: true } },
      customer: { select: { id: true, companyName: true } },
      contact: { select: { firstName: true, lastName: true } },
      _count: { select: { notifications: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const rows: RegistrationRow[] = registrations.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    companyName: r.companyName,
    serialNumber: r.serialNumber,
    status: r.status,
    source: r.source,
    productLabel:
      r.firmwareProduct.model && r.firmwareProduct.model !== r.firmwareProduct.name
        ? `${r.firmwareProduct.name} (${r.firmwareProduct.model})`
        : r.firmwareProduct.name,
    customerId: r.customer?.id ?? null,
    customerName: r.customer?.companyName ?? null,
    contactName: r.contact ? `${r.contact.firstName} ${r.contact.lastName}`.trim() : null,
    notificationCount: r._count.notifications,
    createdAt: r.createdAt.toISOString(),
  }));

  return <RegistrationsClient registrations={rows} />;
}
