import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecurringInvoicesClient } from "./RecurringInvoicesClient";

async function getData() {
  const [recurringInvoices, customers] = await Promise.all([
    prisma.recurringInvoice.findMany({
      include: {
        customer: { select: { companyName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { nextRunDate: "asc" },
    }),
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
  ]);

  return { recurringInvoices, customers };
}

export default async function RecurringInvoicesPage() {
  const { recurringInvoices, customers } = await getData();

  const activeCount = recurringInvoices.filter((r) => r.isActive).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Terugkerende facturen"
        description={`${recurringInvoices.length} sjablonen · ${activeCount} actief`}
      />
      <div className="px-8 py-6">
        <RecurringInvoicesClient
          initialItems={recurringInvoices.map((r) => ({
            id: r.id,
            description: r.description,
            frequency: r.frequency,
            nextRunDate: r.nextRunDate.toISOString(),
            endDate: r.endDate?.toISOString() ?? null,
            isActive: r.isActive,
            customerId: r.customerId,
            customerName: r.customer.companyName,
            lineCount: r._count.lines,
          }))}
          customers={customers}
        />
      </div>
    </div>
  );
}
