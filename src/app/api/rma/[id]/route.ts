import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  try {
    const rma = await prisma.rma.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.customerId !== undefined && { customerId: body.customerId || null }),
        ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo || null }),
        ...(body.resolution !== undefined && { resolution: body.resolution || null }),
        ...(body.resolutionNotes !== undefined && { resolutionNotes: body.resolutionNotes }),
      },
      include: {
        customer: { select: { companyName: true } },
        assignedToUser: { select: { name: true } },
      },
    });

    // Als klant gekoppeld wordt en status nog NEW is, zet naar ASSIGNED
    if (body.customerId && rma.status === "NEW") {
      await prisma.rma.update({ where: { id }, data: { status: "ASSIGNED" } });
    }

    return NextResponse.json(rma);
  } catch (error) {
    console.error("RMA update error:", error);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}
