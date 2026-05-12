import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  const allowed = [
    "companyName", "kvkNumber", "vatNumber",
    "status", "defaultPaymentTerm",
    "notes",
  ];
  for (const f of allowed) {
    if (f in body) data[f] = body[f] === "" ? null : body[f];
  }

  const customer = await prisma.customer.update({ where: { id }, data });
  return NextResponse.json(customer);
}
