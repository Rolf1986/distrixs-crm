import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Alleen niet-gevoelige velden — NOOIT tokens/keys/secrets teruggeven
const PUBLIC_SETTING_FIELDS = {
  id: true,
  companyName: true, logoUrl: true,
  addressLine1: true, addressLine2: true, city: true, postalCode: true, country: true,
  kvkNumber: true, vatNumber: true,
  iban: true, bic: true, bankName: true, ibanAccountHolder: true,
  email: true, phone: true, website: true,
  contactPersonName: true, contactPersonPhone: true, contactPersonEmail: true,
  termsNl: true, termsEn: true, quoteTerms: true, invoiceFooter: true,
  quoteEmailSubject: true, quoteEmailBody: true, quoteEmailSubjectEn: true, quoteEmailBodyEn: true,
  invoiceEmailSubject: true, invoiceEmailBody: true, invoiceEmailSubjectEn: true, invoiceEmailBodyEn: true,
  reminderEmailSubject: true, reminderEmailBody: true,
} as const;

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const settings = await prisma.companySetting.findUnique({
    where: { id: "singleton" },
    select: PUBLIC_SETTING_FIELDS,
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
    "kvkNumber", "vatNumber", "iban", "bic", "bankName", "ibanAccountHolder",
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
    select: PUBLIC_SETTING_FIELDS,
  });

  return NextResponse.json(settings);
}
