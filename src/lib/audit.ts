import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

/** IP voor het auditlog (nginx overschrijft X-Forwarded-For met het echte adres). */
export function clientIpFromRequest(req: NextRequest | Request): string | undefined {
  try {
    return clientIp(req as NextRequest) || undefined;
  } catch {
    return undefined;
  }
}

export async function logAudit(params: {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string;
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
        ip: params.ip ?? null,
      },
    });
  } catch {
    // Never throws — silently swallow errors
  }
}
