import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductsClient } from "./ProductsClient";

async function getProducts() {
  return prisma.product.findMany({
    include: {
      supplier: { select: { id: true, name: true, supplierType: true } },
      _count: { select: { dealLines: true } },
      priceTiers: { orderBy: { minQty: "asc" } },
    },
    orderBy: [{ isActive: "desc" }, { title: "asc" }],
  });
}

async function getSuppliers() {
  return prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, supplierType: true },
    orderBy: { name: "asc" },
  });
}

export default async function ProductsPage() {
  const [products, suppliers] = await Promise.all([getProducts(), getSuppliers()]);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Producten"
        description={`${products.filter((p) => p.isActive).length} actieve producten`}
      />
      <div className="px-8 py-6">
        <ProductsClient
          initialProducts={products.map((p) => ({
            id: p.id,
            sku: p.sku,
            title: p.title,
            supplierName: p.supplier.name,
            supplierId: p.supplier.id,
            supplierType: p.supplier.supplierType as string,
            advisorySellPrice: Number(p.advisorySellPrice),
            baseCostPrice: Number(p.baseCostPrice),
            unit: p.unit,
            isActive: p.isActive,
            dealLineCount: p._count.dealLines,
            priceTiers: p.priceTiers.map((t) => ({
              id: t.id,
              minQty: t.minQty,
              maxQty: t.maxQty,
              unitPrice: Number(t.unitPrice),
            })),
          }))}
          suppliers={suppliers.map((s) => ({
            id: s.id,
            name: s.name,
            supplierType: s.supplierType as string,
          }))}
        />
      </div>
    </div>
  );
}
