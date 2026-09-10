import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { DemoItemsClient } from "./DemoItemsClient";

export const dynamic = "force-dynamic";

async function getDemoItems() {
  return prisma.demoItem.findMany({
    orderBy: [{ location: "asc" }, { product: "asc" }],
  });
}

export default async function DemoItemsPage() {
  const items = await getDemoItems();
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
        />
      </div>
    </div>
  );
}
