import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadsClient } from "./LeadsClient";

async function getLeads() {
  return prisma.lead.findMany({
    include: {
      assignedToUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export default async function LeadsPage() {
  const [leads, users] = await Promise.all([getLeads(), getUsers()]);

  const serialized = leads.map((l) => ({
    id: l.id,
    companyName: l.companyName,
    contactName: l.contactName,
    email: l.email,
    phone: l.phone,
    source: l.source,
    status: l.status,
    estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null,
    notes: l.notes,
    convertedToCustomerId: l.convertedToCustomerId,
    assignedTo: l.assignedTo,
    assignedToUser: l.assignedToUser,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader title="Leads" description="Pipeline overzicht" />
      <LeadsClient leads={serialized} users={users} />
    </div>
  );
}
