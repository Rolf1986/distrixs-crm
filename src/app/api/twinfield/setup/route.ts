import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fetchTwinfieldSetup } from "@/lib/twinfield";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{ twinfield_office_code: string | null }>
    >`SELECT twinfield_office_code FROM company_settings WHERE id = 'singleton' LIMIT 1`;

    const officeCode = rows[0]?.twinfield_office_code;
    if (!officeCode) {
      return NextResponse.json(
        { error: "Twinfield office code niet ingesteld." },
        { status: 400 }
      );
    }

    const result = await fetchTwinfieldSetup(officeCode);
    return NextResponse.json(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[twinfield/setup] error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
