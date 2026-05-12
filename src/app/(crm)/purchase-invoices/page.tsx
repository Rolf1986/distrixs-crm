import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { PurchaseInvoicesClient } from "./PurchaseInvoicesClient";

async function getSupplierInvoices() {
  return prisma.supplierInvoice.findMany({
    include: {
      supplier: { select: { name: true } },
      purchaseOrder: { select: { poNumber: true } },
    },
    orderBy: { invoiceDate: "desc" },
  });
}

async function getSuppliers() {
  return prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

async function getPurchaseOrders() {
  return prisma.purchaseOrder.findMany({
    select: { id: true, poNumber: true, supplierId: true },
    orderBy: { poNumber: "desc" },
  });
}

export default async function PurchaseInvoicesPage() {
  const [invoices, suppliers, purchaseOrders] = await Promise.all([
    getSupplierInvoices(),
    getSuppliers(),
    getPurchaseOrders(),
  ]);

  const openCount = invoices.filter((i) => i.status !== "PAID").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Inkoopfacturen"
        description={`${invoices.length} inkoopfacturen · ${openCount} openstaand`}
      />
      <div className="px-8 py-6">
        <PurchaseInvoicesClient
          invoices={invoices.map((inv) => ({
            id: inv.id,
            supplierName: inv.supplier.name,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate.toISOString(),
            dueDate: inv.dueDate.toISOString(),
            total: Number(inv.total),
            openAmount: Number(inv.openAmount),
            status: inv.status,
            poNumber: inv.purchaseOrder?.poNumber ?? null,
          }))}
          suppliers={suppliers}
          purchaseOrders={purchaseOrders}
        />
      </div>
    </div>
  );
}
