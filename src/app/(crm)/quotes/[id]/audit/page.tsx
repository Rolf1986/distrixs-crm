import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { HistoryTimeline, type HistoryItem } from "@/components/HistoryTimeline";

export default async function QuoteAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const quote = await prisma.quote.findUnique({ where: { id }, select: { id: true } });
  if (!quote) notFound();

  const [logs, emails] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "Quote", entityId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.quoteEmail.findMany({
      where: { quoteId: id },
      select: { id: true, sentAt: true, toAddress: true, subject: true },
      orderBy: { sentAt: "desc" },
    }),
  ]);

  const items: HistoryItem[] = [
    ...logs.map((l) => ({
      kind: "audit" as const,
      id: l.id,
      action: l.action,
      at: l.createdAt.toISOString(),
      user: l.user?.name ?? null,
      oldValue: l.oldValue ?? null,
      newValue: l.newValue ?? null,
    })),
    ...emails.map((e) => ({
      kind: "email" as const,
      id: e.id,
      emailKind: "QUOTE" as const,
      at: e.sentAt.toISOString(),
      to: e.toAddress,
      subject: e.subject,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return <HistoryTimeline basePath={`/api/quotes/${id}`} items={items} />;
}
