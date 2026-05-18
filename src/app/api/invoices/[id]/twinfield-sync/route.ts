import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { syncInvoiceToTwinfield } from "@/lib/twinfield";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const result = await syncInvoiceToTwinfield(id);
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
