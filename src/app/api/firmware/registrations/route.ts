import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { newRegistrationToken } from "@/lib/firmwareSync";

export const dynamic = "force-dynamic";

/** Registraties ophalen, optioneel gefilterd op klant of status. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const status = searchParams.get("status");

  const registrations = await prisma.firmwareRegistration.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status: status as "PENDING" | "ACTIVE" | "UNSUBSCRIBED" } : {}),
    },
    include: {
      firmwareProduct: { select: { id: true, name: true, model: true } },
      customer: { select: { id: true, companyName: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { notifications: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(registrations);
}

/**
 * Registratie aanmaken — dit is het "aanvinken" uit het CRM. De klant hoeft
 * niets te bevestigen: status is meteen ACTIVE.
 *
 * Body: { firmwareProductId, email, customerId?, contactId?, name?, serialNumber? }
 * of   : { items: [ …zelfde velden… ] } voor meerdere tegelijk.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await req.json();
  const items: Array<Record<string, unknown>> = Array.isArray(body.items) ? body.items : [body];

  const created: string[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    const firmwareProductId = typeof item.firmwareProductId === "string" ? item.firmwareProductId : null;
    const email = typeof item.email === "string" ? item.email.trim().toLowerCase() : "";

    if (!firmwareProductId || !email) {
      skipped.push("Product en e-mailadres zijn verplicht");
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push(`Ongeldig e-mailadres: ${email}`);
      continue;
    }

    const existing = await prisma.firmwareRegistration.findUnique({
      where: { firmwareProductId_email: { firmwareProductId, email } },
      select: { id: true, status: true },
    });

    if (existing) {
      // Eerder afgemeld? Die keuze respecteren we — niet stilzwijgend heractiveren.
      if (existing.status === "UNSUBSCRIBED") {
        skipped.push(`${email} heeft zich eerder afgemeld voor dit product`);
        continue;
      }
      await prisma.firmwareRegistration.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          customerId: typeof item.customerId === "string" ? item.customerId : undefined,
          contactId: typeof item.contactId === "string" ? item.contactId : undefined,
          serialNumber: typeof item.serialNumber === "string" ? item.serialNumber : undefined,
        },
      });
      created.push(existing.id);
      continue;
    }

    const reg = await prisma.firmwareRegistration.create({
      data: {
        firmwareProductId,
        email,
        customerId: typeof item.customerId === "string" ? item.customerId : null,
        contactId: typeof item.contactId === "string" ? item.contactId : null,
        name: typeof item.name === "string" ? item.name : null,
        companyName: typeof item.companyName === "string" ? item.companyName : null,
        serialNumber: typeof item.serialNumber === "string" ? item.serialNumber : null,
        source: item.source === "INVOICE" ? "INVOICE" : "MANUAL",
        status: "ACTIVE",
        token: newRegistrationToken(),
      },
      select: { id: true },
    });
    created.push(reg.id);
  }

  return NextResponse.json({ created: created.length, skipped });
}
