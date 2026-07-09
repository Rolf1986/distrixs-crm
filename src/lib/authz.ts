import type { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma";

export type AuthzResult =
  | { ok: true; user: { id: string; role: UserRole } }
  | { ok: false; status: 401 | 403; error: string };

/** Alleen ingelogd — geen rolvereiste. */
export async function requireUser(req?: NextRequest | Request | null): Promise<AuthzResult> {
  const session = await getSession(req ?? null);
  if (!session?.user?.id) return { ok: false, status: 401, error: "Niet ingelogd" };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return { ok: false, status: 401, error: "Niet ingelogd" };
  return { ok: true, user: { id: user.id, role: user.role } };
}

/** Ingelogd én in één van de toegestane rollen. */
export async function requireRole(
  req: NextRequest | Request | null,
  ...roles: UserRole[]
): Promise<AuthzResult> {
  const res = await requireUser(req);
  if (!res.ok) return res;
  if (!roles.includes(res.user.role)) {
    return { ok: false, status: 403, error: "Geen rechten voor deze actie" };
  }
  return res;
}
