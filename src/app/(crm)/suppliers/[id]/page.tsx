import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ChevronRight, Package, ShoppingCart, Mail, Phone } from "lucide-react";
import { SupplierContactsAddresses } from "./SupplierContactsAddresses";

const TYPE_LABEL: Record<string, string> = {
  EU: "🇪🇺 EU",
  CHINA: "🇨🇳 China",
  OTHER: "Overig",
};

async function getSupplier(id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      _count: { select: { products: true, purchaseOrders: true } },
    },
  });
}

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/suppliers" className="hover:text-slate-600 transition-colors">Leveranciers</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-600 font-medium">{supplier.name}</span>
      </div>

      {/* Header */}
      <div className="px-8 pt-3 pb-5 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{supplier.name}</h1>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{TYPE_LABEL[supplier.supplierType] ?? supplier.supplierType}</span>
          <span className="text-xs text-slate-400">{supplier.defaultCurrency}</span>
          {!supplier.isActive && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Inactief</span>}
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
          {supplier.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{supplier.email}</span>}
          {supplier.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{supplier.phone}</span>}
          <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />{supplier._count.products} producten</span>
          <span className="flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5" />{supplier._count.purchaseOrders} inkooporders</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 space-y-6">
        <SupplierContactsAddresses
          supplierId={supplier.id}
          addresses={supplier.addresses.map((a) => ({
            id: a.id, type: a.type as string, isDefault: a.isDefault,
            street: a.street, houseNumber: a.houseNumber, postalCode: a.postalCode,
            city: a.city, country: a.country,
          }))}
          contacts={supplier.contacts.map((c) => ({
            id: c.id, firstName: c.firstName, lastName: c.lastName,
            email: c.email, phone: c.phone, roleOrFunction: c.roleOrFunction, isPrimary: c.isPrimary,
          }))}
        />

        {supplier.notes && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Notities</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{supplier.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
