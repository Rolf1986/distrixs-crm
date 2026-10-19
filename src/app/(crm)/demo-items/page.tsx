import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { DemoItemsClient } from "./DemoItemsClient";

export const dynamic = "force-dynamic";

async function getDemoItems() {
  return prisma.demoItem.findMany({
    orderBy: [{ location: "asc" }, { product: "asc" }],
  });
}

// Voor klantherkenning in de uitgeef-dialoog: kiezen vult bedrijf +
// contactgegevens in; vrij typen blijft mogelijk voor niet-klanten
async function getCustomers() {
  return prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      companyName: true,
      email: true,
      contacts: {
        where: { isActive: true },
        orderBy: { isPrimary: "desc" },
        take: 1,
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
    },
    orderBy: { companyName: "asc" },
  });
}

export default async function DemoItemsPage() {
  const [items, customers] = await Promise.all([getDemoItems(), getCustomers()]);
  const outstanding = items.filter((i) => i.location.toLowerCase() !== "kantoor").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Demo-items"
        description={`${items.length} items · ${outstanding} uitstaand — geen verkoopvoorraad`}
      />
      <div className="px-4 md:px-8 py-6">
        <DemoItemsClient
          initialItems={items.map((i) => ({
            id: i.id,
            product: i.product,
            qty: i.qty,
            location: i.location,
            contactName: i.contactName,
            phone: i.phone,
            email: i.email,
            notes: i.notes,
            outSince: i.outSince ? i.outSince.toISOString() : null,
          }))}
          customers={customers.map((c) => ({
            companyName: c.companyName,
            contactName: c.contacts[0] ? `${c.contacts[0].firstName} ${c.contacts[0].lastName}`.trim() : null,
            phone: c.contacts[0]?.phone ?? null,
            email: c.contacts[0]?.email ?? c.email ?? null,
          }))}
        />
      </div>
    </div>
  );
}
