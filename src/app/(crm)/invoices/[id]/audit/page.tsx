import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { HistoryTimeline, type HistoryItem } from "@/components/HistoryTimeline";

export default async function InvoiceAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { invoiceNumber: true },
  });
  if (!invoice) notFound();

  const [logs, emails, reminders] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "Invoice", entityId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoiceEmail.findMany({
      where: { invoiceId: id },
      select: { id: true, kind: true, sentAt: true, toAddress: true, subject: true },
      orderBy: { sentAt: "desc" },
    }),
    prisma.invoiceReminder.findMany({
      where: { invoiceId: id },
      select: { id: true, sentAt: true, notes: true },
      orderBy: { sentAt: "desc" },
    }),
  ]);

  // Herinneringen die al als mail zijn vastgelegd niet dubbel tonen
  const reminderEmailTimes = emails
    .filter((e) => e.kind === "REMINDER")
    .map((e) => e.sentAt.getTime());

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
      emailKind: e.kind as "INVOICE" | "REMINDER",
      at: e.sentAt.toISOString(),
      to: e.toAddress,
      subject: e.subject,
    })),
    ...reminders
      .filter((r) => !reminderEmailTimes.some((t) => Math.abs(t - r.sentAt.getTime()) < 120000))
      .map((r) => ({
        kind: "reminder" as const,
        id: r.id,
        at: r.sentAt.toISOString(),
        notes: r.notes ?? null,
      })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return <HistoryTimeline basePath={`/api/invoices/${id}`} items={items} />;
}
