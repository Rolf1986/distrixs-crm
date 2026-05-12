import { prisma } from "@/lib/prisma";
import { EmailAccountsClient } from "./EmailAccountsClient";

async function getAccounts() {
  return prisma.emailAccount.findMany({
    select: {
      id: true, label: true, host: true, port: true,
      secure: true, username: true, isActive: true, lastSyncAt: true,
      _count: { select: { emails: true } },
    },
    orderBy: { label: "asc" },
  });
}

export default async function EmailAccountsPage() {
  const accounts = await getAccounts();
  return (
    <EmailAccountsClient
      initialAccounts={accounts.map((a) => ({
        id: a.id,
        label: a.label,
        host: a.host,
        port: a.port,
        secure: a.secure,
        username: a.username,
        isActive: a.isActive,
        lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
        emailCount: a._count.emails,
      }))}
    />
  );
}
