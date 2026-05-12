import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EmailList } from "@/components/EmailList";

async function getEmails(dealId: string) {
  return prisma.email.findMany({
    where: { dealId },
    orderBy: { sentAt: "desc" },
    take: 100,
    include: {
      customer: { select: { id: true, companyName: true } },
    },
  });
}

export default async function DealEmailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const deal = await prisma.deal.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!deal) notFound();

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
        dealNumber: null,
        dealTitle: null,
        customerId: e.customerId,
        customerName: e.customer?.companyName ?? null,
      }))}
      contextType="deal"
      contextId={id}
    />
  );
}
