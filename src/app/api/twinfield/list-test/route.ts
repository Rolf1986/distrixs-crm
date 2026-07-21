import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { twinfieldListTest } from "@/lib/twinfield";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "ADMIN");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const result = await twinfieldListTest();
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Fout" }, { status: 500 });
  }
}
