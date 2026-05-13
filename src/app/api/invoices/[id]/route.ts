import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ("ourReference" in body) data.ourReference = body.ourReference ?? null;
  if ("notes" in body) data.notes = body.notes ?? null;
  if ("language" in body && ["NL", "EN"].includes(body.language)) data.language = body.language;

  const invoice = await prisma.invoice.update({ where: { id }, data });
  return NextResponse.json(invoice);
}
