export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { suggestRegistrationsFromInvoices } from "@/lib/firmwareSync";
import {
  CustomerFirmwareClient,
  type CustomerRegistration,
  type Suggestion,
  type ContactOption,
  type FirmwareProductOption,
} from "./CustomerFirmwareClient";

const dateFmt = (d: Date | null) =>
  d ? d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : null;

export default async function CustomerFirmwarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [registrations, suggestionRows, contacts, firmwareProducts] = await Promise.all([
    prisma.firmwareRegistration.findMany({
      where: { customerId: id },
      include: {
        firmwareProduct: { select: { name: true, model: true } },
        contact: { select: { firstName: true, lastName: true } },
        _count: { select: { notifications: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    suggestRegistrationsFromInvoices(id),
    prisma.customerContact.findMany({
      where: { customerId: id, isActive: true, email: { not: null } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }],
    }),
    prisma.firmwareProduct.findMany({
      where: { isActive: true, releases: { some: {} } },
      select: { id: true, name: true, model: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const regRows: CustomerRegistration[] = registrations.map((r) => ({
    id: r.id,
    productLabel:
      r.firmwareProduct.model && r.firmwareProduct.model !== r.firmwareProduct.name
        ? `${r.firmwareProduct.name} (${r.firmwareProduct.model})`
        : r.firmwareProduct.name,
    email: r.email,
    contactName: r.contact ? `${r.contact.firstName} ${r.contact.lastName}`.trim() : r.name,
    serialNumber: r.serialNumber,
    status: r.status,
    notificationCount: r._count.notifications,
    lastNotifiedAt: dateFmt(r.lastNotifiedAt),
  }));

  const suggestions: Suggestion[] = suggestionRows.map((s) => ({
    firmwareProductId: s.firmwareProductId,
    firmwareProductLabel: s.firmwareProductLabel,
    productSku: s.productSku,
    productTitle: s.productTitle,
    contactId: s.contactId,
    contactName: s.contactName,
    email: s.email,
    lastInvoiceNumber: s.lastInvoiceNumber,
    lastInvoiceDate: dateFmt(s.lastInvoiceDate),
  }));

  const contactOptions: ContactOption[] = contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email!,
  }));

  const productOptions: FirmwareProductOption[] = firmwareProducts.map((p) => ({
    id: p.id,
    label: p.model && p.model !== p.name ? `${p.name} (${p.model})` : p.name,
  }));

  return (
    <CustomerFirmwareClient
      customerId={id}
      registrations={regRows}
      suggestions={suggestions}
      contacts={contactOptions}
      firmwareProducts={productOptions}
    />
  );
}
