import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newRegistrationToken } from "@/lib/firmwareSync";

export const dynamic = "force-dynamic";

/**
 * Publiek aanmeldformulier (geen sessie). Een aanmelding komt binnen als PENDING
 * en wordt pas actief nadat iemand hem in het CRM goedkeurt — zo kan niemand
 * ongemerkt een adres van een ander op de lijst zetten.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const firmwareProductId = typeof body.firmwareProductId === "string" ? body.firmwareProductId : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : null;
  const companyName = typeof body.companyName === "string" ? body.companyName.trim().slice(0, 160) : null;
  const serialNumber = typeof body.serialNumber === "string" ? body.serialNumber.trim().slice(0, 80) : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  }
  if (!firmwareProductId) {
    return NextResponse.json({ error: "Kies een product." }, { status: 400 });
  }

  const product = await prisma.firmwareProduct.findUnique({
    where: { id: firmwareProductId },
    select: { id: true },
  });
  if (!product) return NextResponse.json({ error: "Onbekend product." }, { status: 400 });

  const existing = await prisma.firmwareRegistration.findUnique({
    where: { firmwareProductId_email: { firmwareProductId, email } },
    select: { id: true, status: true },
  });

  if (existing) {
    // Eerder afgemeld en nu opnieuw aangemeld: dat is een nieuw verzoek van de
    // klant zelf, dus terug naar de wachtrij voor goedkeuring.
    if (existing.status === "UNSUBSCRIBED") {
      await prisma.firmwareRegistration.update({
        where: { id: existing.id },
        data: { status: "PENDING", source: "SELF", unsubscribedAt: null, serialNumber, name, companyName },
      });
    }
    return NextResponse.json({ ok: true, alreadyKnown: true });
  }

  await prisma.firmwareRegistration.create({
    data: {
      firmwareProductId,
      email,
      name,
      companyName,
      serialNumber,
      source: "SELF",
      status: "PENDING",
      token: newRegistrationToken(),
    },
  });

  return NextResponse.json({ ok: true });
}
