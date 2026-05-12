import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PoLinesClient } from "./PoLinesClient";

async function getPo(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { supplierType: true } },
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
}

async function getProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, title: true, baseCostPrice: true },
    orderBy: { title: "asc" },
  });
}

export default async function PoLinesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [po, products] = await Promise.all([getPo(id), getProducts()]);
  if (!po) notFound();

  return (
    <PoLinesClient
      poId={id}
      isChina={po.supplier.supplierType === "CHINA"}
      initialLines={po.lines.map((l) => ({
        id: l.id,
        skuSnapshot: l.skuSnapshot,
        titleSnapshot: l.titleSnapshot,
        qtyOrdered: Number(l.qtyOrdered),
        qtyReceived: Number(l.qtyReceived),
        baseCostSnapshot: Number(l.baseCostSnapshot),
        status: l.status,
      }))}
      products={products.map((p) => ({
        id: p.id,
        sku: p.sku,
        title: p.title,
        baseCostPrice: Number(p.baseCostPrice),
      }))}
    />
  );
}
