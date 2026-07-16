import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { TabNav } from "@/components/TabNav";
import { CustomerQuickCreate } from "@/components/CustomerQuickCreate";
import { ChevronRight } from "lucide-react";

async function getCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      _count: { select: { deals: true, quotes: true, invoices: true, contacts: true, emails: true } },
    },
  });
}

export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const statusMap: Record<string, string> = {
    ACTIVE: "Actief",
    INACTIVE: "Inactief",
    PROSPECT: "Prospect",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/customers" className="hover:text-slate-600 transition-colors">
          Klanten
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-600 font-medium">{customer.companyName}</span>
      </div>

      {/* Header */}
      <div className="px-8 pt-3 pb-5 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{customer.companyName}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="font-mono text-xs text-slate-400">{customer.customerNumber}</span>
              <StatusBadge status={customer.status} />
            </div>
          </div>
          <CustomerQuickCreate customerId={id} companyName={customer.companyName} />
        </div>

        {/* KPI's */}
        <div className="grid grid-cols-5 gap-3 mt-5">
          <KpiCard label="Deals" value={String(customer._count.deals)} />
          <KpiCard label="Offertes" value={String(customer._count.quotes)} />
          <KpiCard label="Facturen" value={String(customer._count.invoices)} />
          <KpiCard label="Contacten" value={String(customer._count.contacts)} />
          <KpiCard label="E-mails" value={String(customer._count.emails)} />
        </div>

        {/* Tabs */}
        <TabNav
          tabs={[
            { label: "Info",        href: `/customers/${id}`,             exact: true },
            { label: "Deals",       href: `/customers/${id}/deals` },
            { label: "Offertes",    href: `/customers/${id}/quotes` },
            { label: "Facturen",    href: `/customers/${id}/invoices` },
            { label: "Contacten",   href: `/customers/${id}/contacts` },
            { label: "Activiteiten", href: `/customers/${id}/activities` },
            { label: "E-mails",      href: `/customers/${id}/emails` },
            { label: "Prijslijst",   href: `/customers/${id}/pricelists` },
          ]}
        />
      </div>

      {/* Tab content */}
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
