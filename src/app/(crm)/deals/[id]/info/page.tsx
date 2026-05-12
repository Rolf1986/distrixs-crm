import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DealInfoClient } from "./DealInfoClient";

async function getDealInfo(id: string) {
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          companyName: true,
          contacts: {
            where: { isActive: true },
            select: { id: true, firstName: true, lastName: true, roleOrFunction: true },
            orderBy: { isPrimary: "desc" },
          },
        },
      },
      primaryContact: {
        select: { id: true, firstName: true, lastName: true, roleOrFunction: true },
      },
      createdByUser: { select: { name: true } },
      activities: {
        where: { status: "OPEN" },
        include: { createdByUser: { select: { name: true } } },
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 5,
      },
      _count: { select: { activities: true } },
    },
  });
  return deal;
}

export default async function DealInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealInfo(id);
  if (!deal) notFound();

  return (
    <DealInfoClient
      deal={{
        id: deal.id,
        title: deal.title,
        notes: deal.notes ?? "",
        customerId: deal.customerId,
        customerName: deal.customer.companyName,
        primaryContactId: deal.primaryContactId ?? null,
        primaryContact: deal.primaryContact
          ? {
              id: deal.primaryContact.id,
              name: `${deal.primaryContact.firstName} ${deal.primaryContact.lastName}`,
              role: deal.primaryContact.roleOrFunction ?? null,
            }
          : null,
        contacts: deal.customer.contacts.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          role: c.roleOrFunction ?? null,
        })),
        createdByUser: { name: deal.createdByUser.name },
        createdAt: deal.createdAt.toISOString(),
        openActivitiesCount: deal._count.activities,
        upcomingActivities: deal.activities.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          dueAt: a.dueAt?.toISOString() ?? null,
          createdByUser: { name: a.createdByUser.name },
        })),
      }}
    />
  );
}
