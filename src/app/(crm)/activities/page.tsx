import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActivitiesClient } from "./ActivitiesClient";
import { CreateActivityButton } from "@/components/CreateActivityButton";

async function getAllActivities() {
  return prisma.activity.findMany({
    include: {
      createdByUser: { select: { name: true } },
      deal: { select: { id: true, dealNumber: true, title: true } },
    },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
}

async function getActiveDeals() {
  return prisma.deal.findMany({
    where: { status: { notIn: ["WON", "LOST"] } },
    select: { id: true, dealNumber: true, title: true },
    orderBy: { dealNumber: "asc" },
  });
}

async function getActiveCustomers() {
  return prisma.customer.findMany({
    where: { status: { in: ["ACTIVE", "PROSPECT"] } },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });
}

export default async function ActivitiesPage() {
  const [activities, deals, customers] = await Promise.all([
    getAllActivities(),
    getActiveDeals(),
    getActiveCustomers(),
  ]);

  const now = new Date();

  const serialized = activities.map((a) => ({
    id: a.id,
    type: a.type as string,
    title: a.title,
    notes: a.notes,
    status: a.status as string,
    dueAt: a.dueAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    createdByUser: { name: a.createdByUser.name },
    deal: a.deal
      ? { id: a.deal.id, dealNumber: a.deal.dealNumber, title: a.deal.title }
      : null,
  }));

  const openCount = serialized.filter((a) => a.status !== "DONE").length;
  const overdueCount = serialized.filter(
    (a) => a.status !== "DONE" && a.dueAt && new Date(a.dueAt) < now
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Activiteiten"
        description={
          overdueCount > 0
            ? `${openCount} open · ${overdueCount} verlopen`
            : `${openCount} open taken`
        }
        action={
          <CreateActivityButton
            deals={deals}
            customers={customers}
          />
        }
      />
      <div className="px-8 py-6">
        <ActivitiesClient activities={serialized} />
      </div>
    </div>
  );
}
