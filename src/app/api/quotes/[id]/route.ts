import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ("validUntil" in body) {
    data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
  }
  if ("language" in body && ["NL", "EN"].includes(body.language)) {
    data.language = body.language;
  }

  const quote = await prisma.quote.update({ where: { id }, data });
  return NextResponse.json(quote);
}
