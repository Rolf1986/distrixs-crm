import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const ALLOWED_FIELDS = [
  "twinfield_office_code",
  "twinfield_transaction_type",
  "twinfield_debtor_account",
  "twinfield_revenue_account",
  "twinfield_vat_code",
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json() as Record<string, unknown>;

  // Collect valid string fields from body
  const updates: Partial<Record<AllowedField, string>> = {};
  for (const field of ALLOWED_FIELDS) {
    const value = body[field];
    if (typeof value === "string") {
      updates[field] = value.trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Geen geldige velden" }, { status: 400 });
  }

  // Apply each field via raw SQL (columns not yet in Prisma generated client)
  if (updates.twinfield_office_code !== undefined) {
    await prisma.$executeRaw`
      UPDATE company_settings SET twinfield_office_code = ${updates.twinfield_office_code} WHERE id = 'singleton'
    `;
  }
  if (updates.twinfield_transaction_type !== undefined) {
    await prisma.$executeRaw`
      UPDATE company_settings SET twinfield_transaction_type = ${updates.twinfield_transaction_type} WHERE id = 'singleton'
    `;
  }
  if (updates.twinfield_debtor_account !== undefined) {
    await prisma.$executeRaw`
      UPDATE company_settings SET twinfield_debtor_account = ${updates.twinfield_debtor_account} WHERE id = 'singleton'
    `;
  }
  if (updates.twinfield_revenue_account !== undefined) {
    await prisma.$executeRaw`
      UPDATE company_settings SET twinfield_revenue_account = ${updates.twinfield_revenue_account} WHERE id = 'singleton'
    `;
  }
  if (updates.twinfield_vat_code !== undefined) {
    await prisma.$executeRaw`
      UPDATE company_settings SET twinfield_vat_code = ${updates.twinfield_vat_code} WHERE id = 'singleton'
    `;
  }

  return NextResponse.json({ ok: true });
}
