import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json() as Record<string, unknown>;
  const officeCode = body.twinfield_office_code;

  if (typeof officeCode !== "string") {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  await prisma.$executeRaw`
    UPDATE company_settings
    SET twinfield_office_code = ${officeCode.trim()}
    WHERE id = 'singleton'
  `;

  return NextResponse.json({ ok: true });
}
