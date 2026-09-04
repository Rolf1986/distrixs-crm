export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/Sidebar";
import { InstallAppHint } from "@/components/InstallAppHint";
import { BackButton } from "@/components/BackButton";
import { prisma } from "@/lib/prisma";

async function getOverdueActivityCount() {
  return prisma.activity.count({
    where: {
      status: "OPEN",
      dueAt: { lt: new Date() },
      type: { in: ["TASK", "CALL", "MEETING"] },
    },
  });
}

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const overdueActivityCount = await getOverdueActivityCount();
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar overdueActivityCount={overdueActivityCount} />
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-h-screen w-full min-w-0">{children}</main>
      <InstallAppHint />
      <BackButton />
    </div>
  );
}
