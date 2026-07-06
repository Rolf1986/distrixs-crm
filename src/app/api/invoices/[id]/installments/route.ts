import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Termijnen horen bij lopende facturen; op betaalde/gecrediteerde of
// Twinfield-gelockte facturen mag het schema niet meer wijzigen.
async function assertInstallmentsEditable(invoiceId: string): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, twinfieldLocked: true },
  });
  if (!invoice) return "Factuur niet gevonden";
  if (invoice.twinfieldLocked) return "Factuur is vergrendeld na Twinfield-synchronisatie";
  if (invoice.status === "PAID" || invoice.status === "CREDITED") {
    return "Termijnen kunnen niet gewijzigd worden op een betaalde of gecrediteerde factuur";
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const installments = await prisma.invoiceInstallment.findMany({
    where: { invoiceId: id },
    orderBy: { installmentNumber: "asc" },
  });
  return NextResponse.json(installments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const guardError = await assertInstallmentsEditable(id);
  if (guardError) return NextResponse.json({ error: guardError }, { status: 409 });

  const body = await req.json() as {
    installmentNumber: number;
    dueDate: string;
    percentage?: number | null;
    amount?: number | null;
    notes?: string | null;
  };

  if (!body.dueDate) {
    return NextResponse.json({ error: "dueDate is verplicht" }, { status: 400 });
  }
  if (!body.percentage && !body.amount) {
    return NextResponse.json({ error: "Vul percentage of bedrag in" }, { status: 400 });
  }

  const installment = await prisma.invoiceInstallment.create({
    data: {
      invoiceId: id,
      installmentNumber: body.installmentNumber,
      dueDate: new Date(body.dueDate),
      percentage: body.percentage ?? null,
      amount: body.amount ?? null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(installment);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const guardError = await assertInstallmentsEditable(id);
  if (guardError) return NextResponse.json({ error: guardError }, { status: 409 });

  // Verwijder alle termijnen voor deze factuur (reset)
  await prisma.invoiceInstallment.deleteMany({ where: { invoiceId: id } });
  return NextResponse.json({ ok: true });
}
