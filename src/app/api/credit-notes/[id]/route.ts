import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  const creditNote = await prisma.creditNote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, companyName: true, vatNumber: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      lines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!creditNote) {
    return NextResponse.json({ error: "Creditnota niet gevonden" }, { status: 404 });
  }

  return NextResponse.json(creditNote);
}
