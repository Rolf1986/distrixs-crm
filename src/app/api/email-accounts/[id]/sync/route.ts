import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncEmailAccount } from "@/lib/imap";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const result = await syncEmailAccount(id, 200);
  return NextResponse.json(result);
}
