import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EmailList } from "@/components/EmailList";

async function getEmails(customerId: string) {
  return prisma.email.findMany({
    where: { customerId },
    orderBy: { sentAt: "desc" },
    take: 100,
    include: {
      deal: { select: { id: true, dealNumber: true, title: true } },
    },
  });
}

export default async function CustomerEmailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!customer) notFound();

  const emails = await getEmails(id);

  return (
    <EmailList
      emails={emails.map((e) => ({
        id: e.id,
        subject: e.subject,
        fromName: e.fromName,
        fromEmail: e.fromAddress,
        date: e.sentAt.toISOString(),
        snippet: e.snippet,
        hasBody: e.uid !== null,
        uid: e.uid,
        accountId: e.accountId,
        dealId: e.dealId,
        dealNumber: e.deal?.dealNumber ?? null,
        dealTitle: e.deal?.title ?? null,
        customerId: e.customerId,
      }))}
      contextType="customer"
      contextId={id}
    />
  );
}
