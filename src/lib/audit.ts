import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue:
          params.oldValue !== undefined
            ? JSON.stringify(params.oldValue)
            : null,
        newValue:
          params.newValue !== undefined
            ? JSON.stringify(params.newValue)
            : null,
      },
    });
  } catch {
    // Never throws — silently swallow errors
  }
}
