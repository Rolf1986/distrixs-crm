import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ActivitiesClient } from "@/app/(crm)/activities/ActivitiesClient";
import { CreateActivityButton } from "@/components/CreateActivityButton";

async function getCustomerActivities(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) return null;

  return prisma.activity.findMany({
    where: {
      OR: [
        { customerId },
        { deal: { customerId } },
      ],
    },
    include: {
      createdByUser: { select: { name: true } },
      deal: { select: { id: true, dealNumber: true, title: true } },
    },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
}

async function getCustomerDeals(customerId: string) {
  return prisma.deal.findMany({
    where: { customerId, status: { notIn: ["WON", "LOST"] } },
    select: { id: true, dealNumber: true, title: true },
    orderBy: { dealNumber: "asc" },
  });
}

export default async function CustomerActivitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [activities, deals] = await Promise.all([
    getCustomerActivities(id),
    getCustomerDeals(id),
  ]);
  if (!activities) notFound();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Activiteiten ({activities.length})
        </h2>
        <CreateActivityButton
          customerId={id}
          deals={deals}
        />
      </div>

      <ActivitiesClient
        activities={activities.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          notes: a.notes,
          status: a.status,
          dueAt: a.dueAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          createdByUser: { name: a.createdByUser.name },
          deal: a.deal ? { id: a.deal.id, dealNumber: a.deal.dealNumber, title: a.deal.title } : null,
        }))}
      />
    </div>
  );
}
