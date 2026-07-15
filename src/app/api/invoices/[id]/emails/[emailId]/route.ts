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
  const email = await prisma.invoiceEmail.findFirst({
    where: { id: emailId, invoiceId: id },
    select: { subject: true, toAddress: true, ccAddress: true, sentAt: true, bodyHtml: true, kind: true },
  });
  if (!email) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  return NextResponse.json(email);
}
