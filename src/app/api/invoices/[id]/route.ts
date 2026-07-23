import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ("ourReference" in body) data.ourReference = body.ourReference ?? null;
  if ("notes" in body) data.notes = body.notes ?? null;
  if ("language" in body && ["NL", "EN"].includes(body.language)) data.language = body.language;

  // Factuur achteraf aan een deal koppelen (metadata; mag ook op verzonden/
  // vergrendelde facturen). Deal moet van dezelfde klant zijn.
  if ("dealId" in body) {
    if (body.dealId) {
      const [inv, deal] = await Promise.all([
        prisma.invoice.findUnique({ where: { id }, select: { customerId: true } }),
        prisma.deal.findUnique({ where: { id: body.dealId }, select: { customerId: true } }),
      ]);
      if (!deal) return NextResponse.json({ error: "Deal niet gevonden" }, { status: 404 });
      if (inv && deal.customerId !== inv.customerId) {
        return NextResponse.json({ error: "Deal hoort bij een andere klant" }, { status: 400 });
      }
      data.dealId = body.dealId;
    } else {
      data.dealId = null;
    }
  }

  // Vervaldatum aanpasbaar (bv. betaalafspraak verlengen). Niet op een
  // via Twinfield vergrendelde factuur.
  const wantsDueDate = "dueDate" in body && body.dueDate;
  if (wantsDueDate || "paymentTermType" in body) {
    const inv = await prisma.invoice.findUnique({ where: { id }, select: { twinfieldLocked: true } });
    if (!inv) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    if (inv.twinfieldLocked) {
      return NextResponse.json({ error: "Factuur is vergrendeld via Twinfield" }, { status: 403 });
    }
    if (wantsDueDate) {
      const d = new Date(body.dueDate);
      if (!isNaN(d.getTime())) data.dueDate = d;
    }
    if ("paymentTermType" in body && ["DAYS_14", "DAYS_30", "PREPAYMENT", "INSTALLMENTS"].includes(body.paymentTermType)) {
      data.paymentTermType = body.paymentTermType;
    }
  }

  const invoice = await prisma.invoice.update({ where: { id }, data });
  return NextResponse.json(invoice);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  if (invoice.status !== "DRAFT") {
    return NextResponse.json({ error: "Alleen conceptfacturen kunnen worden verwijderd" }, { status: 400 });
  }

  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
