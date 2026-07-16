import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { companyName, kvkNumber, vatNumber, defaultPaymentTerm, status } = await req.json();
  if (!companyName) return NextResponse.json({ error: "Bedrijfsnaam verplicht" }, { status: 400 });

  // Auto-nummer: K-YYYY-NNN
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
      companyName,
      kvkNumber: kvkNumber || null,
      vatNumber: vatNumber || null,
      defaultPaymentTerm: defaultPaymentTerm || "DAYS_14",
      status: status || "ACTIVE",
    },
  });

  return NextResponse.json({ id: customer.id, customerNumber: customer.customerNumber });
}
