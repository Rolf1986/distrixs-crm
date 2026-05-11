import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreateDealButton } from "@/components/CreateDealButton";
import { DealsViewWrapper } from "@/components/DealsViewWrapper";
import type { SerializedDeal } from "@/components/DealKanbanView";
import { TrendingUp } from "lucide-react";

async function getDeals() {
  return prisma.deal.findMany({
    include: {
      customer: { select: { companyName: true } },
      // Omzet komt uit offertes, niet uit deallines
      quotes: {
        where: { status: { not: "REJECTED" } },
        select: { total: true },
      },
      _count: { select: { invoices: true } },
      activities: {
        where: { status: "OPEN" },
        orderBy: { dueAt: "asc" },
        select: { id: true, dueAt: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getCustomers() {
  return prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });
}

export default async function DealsPage() {
  const [deals, customers] = await Promise.all([getDeals(), getCustomers()]);

  // Serialize for client components (Decimal → number, Date → ISO string)
  const serialized: SerializedDeal[] = deals.map((d) => {
    const activity = d.activities[0] ?? null;
    const hasOpenActivity = !!activity;
    const hasOverdueActivity =
      hasOpenActivity && !!activity.dueAt && new Date(activity.dueAt) < new Date();
    return {
      id: d.id,
      dealNumber: d.dealNumber,
      title: d.title,
      status: d.status,
      customer: { companyName: d.customer.companyName },
      omzet: d.quotes.reduce((s, q) => s + Number(q.total), 0),
      gefactureerd: d._count.invoices > 0,
      hasOpenActivity,
      hasOverdueActivity,
      expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
      winProbability: d.winProbability,
      createdAt: d.createdAt.toISOString(),
    };
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Deals"
        description={`${deals.length} deals`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/deals/forecast"
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-white rounded-lg px-3 py-2 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Forecast
            </Link>
            <CreateDealButton customers={customers} />
          </div>
        }
      />
      <div className="px-8 py-6">
        <DealsViewWrapper deals={serialized} />
      </div>
    </div>
  );
}
