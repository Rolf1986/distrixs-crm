import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Afmelden met de token uit de mail. Bewust een POST: e-mailscanners volgen
 * links vooruit, en een GET zou een klant dan ongevraagd afmelden.
 */
export async function POST(req: NextRequest) {
  let token = "";
  try {
    const body = await req.json();
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  if (!token) return NextResponse.json({ error: "Ongeldige link" }, { status: 400 });

  const registration = await prisma.firmwareRegistration.findUnique({
    where: { token },
    select: { id: true },
  });
  if (!registration) return NextResponse.json({ error: "Deze link is niet (meer) geldig." }, { status: 404 });

  await prisma.firmwareRegistration.update({
    where: { id: registration.id },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
