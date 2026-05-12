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
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  // Verwijder alle termijnen voor deze factuur (reset)
  await prisma.invoiceInstallment.deleteMany({ where: { invoiceId: id } });
  return NextResponse.json({ ok: true });
}
