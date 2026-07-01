import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreateCustomerButton } from "@/components/CreateCustomerButton";
import { CustomersClient } from "./CustomersClient";

async function getCustomers() {
  return prisma.customer.findMany({
    include: {
      _count: { select: { deals: true, contacts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function CustomersPage() {
  const customers = await getCustomers();
  const activeCount = customers.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Klanten"
        description={`${customers.length} klanten · ${activeCount} actief`}
        action={<CreateCustomerButton />}
      />
      <div className="px-8 py-6">
        <CustomersClient
          customers={customers.map((c) => ({
            id: c.id,
            customerNumber: c.customerNumber,
            companyName: c.companyName,
            kvkNumber: c.kvkNumber,
            vatNumber: c.vatNumber,
            status: c.status,
            dealCount: c._count.deals,
            contactCount: c._count.contacts,
          }))}
        />
      </div>
    </div>
  );
}
