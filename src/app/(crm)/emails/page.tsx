import { prisma } from "@/lib/prisma";
import EmailsPageClient from "./EmailsPageClient";

export default async function EmailsPage() {
  const [emails, accounts] = await Promise.all([
    prisma.email.findMany({
      orderBy: { sentAt: "desc" },
      take: 500,
      include: {
        customer: { select: { id: true, companyName: true } },
        deal: { select: { id: true, dealNumber: true, title: true } },
      },
    }),
    prisma.emailAccount.findMany({
      where: { isActive: true },
      select: { id: true, label: true },
    }),
  ]);

  return <EmailsPageClient emails={emails} accounts={accounts} />;
}
