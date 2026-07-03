import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Sluit een webshop-account uit van analytics (eigen/interne accounts).
// Bij uitsluiten wordt ook de al verzamelde data van dit account gewist,
// zodat de statistieken schoon zijn.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { excluded?: boolean };
  const excluded = body.excluded === true;

  const account = await prisma.webshopAccount.findUnique({ where: { id }, select: { id: true } });
  if (!account) return NextResponse.json({ error: "Account niet gevonden" }, { status: 404 });

  let removedSessions = 0;
  if (excluded) {
    const visitors = await prisma.analyticsVisitor.findMany({
      where: { accountId: id },
      select: { id: true },
    });
    const visitorIds = visitors.map((v) => v.id);
    if (visitorIds.length > 0) {
      await prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: visitorIds } } });
      const del = await prisma.analyticsSession.deleteMany({ where: { visitorId: { in: visitorIds } } });
      removedSessions = del.count;
    }
  }

  await prisma.webshopAccount.update({ where: { id }, data: { excluded } });
  return NextResponse.json({ ok: true, excluded, removedSessions });
}
