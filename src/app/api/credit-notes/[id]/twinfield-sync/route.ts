import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { syncCreditNoteToTwinfield } from "@/lib/twinfield";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const result = await syncCreditNoteToTwinfield(id);

  if (result.success) {
    await logAudit({
      userId: session.user.id,
      action: "credit_note.twinfield_synced",
      entityType: "CreditNote",
      entityId: id,
      newValue: result.reference ?? null,
    });
  }

  return NextResponse.json(result, { status: result.success ? 200 : 422 });
}
