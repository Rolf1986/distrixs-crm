import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id, emailId } = await params;
  const email = await prisma.quoteEmail.findFirst({
    where: { id: emailId, quoteId: id },
    select: { subject: true, toAddress: true, ccAddress: true, sentAt: true, bodyHtml: true },
  });
  if (!email) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  return NextResponse.json(email);
}
