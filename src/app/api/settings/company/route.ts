import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.companySetting.findUnique({
    where: { id: "singleton" },
  });
  return NextResponse.json(settings ?? { id: "singleton" });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json();
  const allowedFields = [
    "companyName", "logoUrl",
    "addressLine1", "addressLine2", "city", "postalCode", "country",
    "kvkNumber", "vatNumber", "iban", "bic", "bankName",
    "email", "phone", "website",
    "contactPersonName", "contactPersonPhone", "contactPersonEmail",
    "termsNl", "termsEn",
    "quoteTerms", "invoiceFooter",
    "quoteEmailSubject", "quoteEmailBody",
    "invoiceEmailSubject", "invoiceEmailBody",
    "reminderEmailSubject", "reminderEmailBody",
  ];

  const data: Record<string, string | null> = {};
  for (const field of allowedFields) {
    if (field in body) {
      data[field] = body[field] ?? null;
    }
  }

  const settings = await prisma.companySetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  return NextResponse.json(settings);
}
