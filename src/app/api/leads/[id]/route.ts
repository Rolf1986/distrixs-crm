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
  const { status, notes, assignedTo, estimatedValue } = body;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ error: "Lead niet gevonden" }, { status: 404 });
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;
  if (estimatedValue !== undefined)
    updateData.estimatedValue = estimatedValue ? Number(estimatedValue) : null;

  // Special: if converting to CONVERTED, create a Customer from lead data
  if (status === "CONVERTED" && lead.status !== "CONVERTED") {
    const year = new Date().getFullYear();
    const prefix = `K-${year}-`;
    const lastCustomer = await prisma.customer.findFirst({
      where: { customerNumber: { startsWith: prefix } },
      orderBy: { customerNumber: "desc" },
    });
    const lastSeq = lastCustomer
      ? parseInt(lastCustomer.customerNumber.replace(prefix, ""), 10)
      : 0;
    const customerNumber = `${prefix}${String(lastSeq + 1).padStart(3, "0")}`;

    const customer = await prisma.customer.create({
      data: {
        customerNumber,
        companyName: lead.companyName,
        status: "PROSPECT",
      },
    });

    updateData.convertedToCustomerId = customer.id;
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: updateData,
    include: {
      assignedToUser: { select: { id: true, name: true } },
      convertedToCustomer: { select: { id: true, customerNumber: true } },
    },
  });

  return NextResponse.json(updated);
}
