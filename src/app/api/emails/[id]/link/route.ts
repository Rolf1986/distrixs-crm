import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/** Koppel een e-mail aan een klant en/of deal */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { customerId?: string | null; dealId?: string | null };

  const updated = await prisma.email.update({
    where: { id },
    data: {
      customerId: "customerId" in body ? (body.customerId ?? null) : undefined,
      dealId:     "dealId"     in body ? (body.dealId ?? null)     : undefined,
    },
  });

  return NextResponse.json(updated);
}
