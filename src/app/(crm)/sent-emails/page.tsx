import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { SentEmailsClient } from "./SentEmailsClient";

export const dynamic = "force-dynamic";

export default async function SentEmailsPage() {
  const emails = await prisma.sentEmail.findMany({
    select: {
      id: true, category: true, toAddress: true, subject: true,
      relatedType: true, relatedId: true, relatedLabel: true, customerName: true, sentAt: true,
    },
    orderBy: { sentAt: "desc" },
    take: 500,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Verzonden e-mails" description={`${emails.length} verstuurde mails vanuit het CRM`} />
      <div className="px-8 py-6">
        <SentEmailsClient
          emails={emails.map((e) => ({
            id: e.id,
            category: e.category as string,
            toAddress: e.toAddress,
            subject: e.subject,
            relatedType: e.relatedType,
            relatedId: e.relatedId,
            relatedLabel: e.relatedLabel,
            customerName: e.customerName,
            sentAt: e.sentAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
