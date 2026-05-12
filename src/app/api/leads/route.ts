import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const leads = await prisma.lead.findMany({
    include: {
      assignedToUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json();
  const {
    companyName,
    contactName,
    email,
    phone,
    source,
    estimatedValue,
    notes,
    assignedTo,
  } = body;

  if (!companyName) {
    return NextResponse.json({ error: "Bedrijfsnaam is verplicht" }, { status: 400 });
  }
  if (!source) {
    return NextResponse.json({ error: "Bron is verplicht" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      companyName,
      contactName: contactName || null,
      email: email || null,
      phone: phone || null,
      source,
      estimatedValue: estimatedValue ? Number(estimatedValue) : null,
      notes: notes || null,
      assignedTo: assignedTo || null,
      createdBy: session.user.id,
    },
    include: {
      assignedToUser: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(lead, { status: 201 });
}
