import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { SuppliersClient } from "./SuppliersClient";

async function getSuppliers() {
  return prisma.supplier.findMany({
    include: { _count: { select: { products: true, purchaseOrders: true } } },
    orderBy: { name: "asc" },
  });
}

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Leveranciers" description={`${suppliers.length} leveranciers`} />
      <div className="px-8 py-6">
        <SuppliersClient
          initialSuppliers={suppliers.map((s) => ({
            id: s.id,
            name: s.name,
            supplierType: s.supplierType as string,
            defaultCurrency: s.defaultCurrency,
            email: s.email,
            phone: s.phone,
            notes: s.notes,
            isActive: s.isActive,
            productCount: s._count.products,
            poCount: s._count.purchaseOrders,
          }))}
        />
      </div>
    </div>
  );
}
