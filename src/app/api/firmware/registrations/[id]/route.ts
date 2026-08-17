import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildConfirmedEmail } from "@/lib/firmwareEmail";

export const dynamic = "force-dynamic";

/**
 * Registratie bijwerken: status omzetten (bv. een zelfaanmelding goedkeuren),
 * serienummer of contactpersoon aanpassen.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const current = await prisma.firmwareRegistration.findUnique({
    where: { id },
    include: { firmwareProduct: true },
  });
  if (!current) return NextResponse.json({ error: "Registratie niet gevonden" }, { status: 404 });

  const nextStatus =
    body.status === "ACTIVE" || body.status === "PENDING" || body.status === "UNSUBSCRIBED" ? body.status : undefined;

  const updated = await prisma.firmwareRegistration.update({
    where: { id },
    data: {
      status: nextStatus,
      confirmedAt: nextStatus === "ACTIVE" && !current.confirmedAt ? new Date() : undefined,
      unsubscribedAt: nextStatus === "UNSUBSCRIBED" ? new Date() : undefined,
      serialNumber: typeof body.serialNumber === "string" ? body.serialNumber || null : undefined,
      name: typeof body.name === "string" ? body.name || null : undefined,
      email: typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : undefined,
      contactId: typeof body.contactId === "string" ? body.contactId || null : undefined,
      customerId: typeof body.customerId === "string" ? body.customerId || null : undefined,
    },
  });

  // Zelfaanmelding goedgekeurd? Dan hoort de klant een bevestiging te krijgen,
  // want hij heeft er zelf om gevraagd.
  const isApprovedSelfSignup = current.source === "SELF" && current.status === "PENDING" && nextStatus === "ACTIVE";
  if (isApprovedSelfSignup) {
    const latest = await prisma.firmwareRelease.findFirst({
      where: { firmwareProductId: current.firmwareProductId },
      orderBy: [{ releaseDate: "desc" }, { firstSeenAt: "desc" }],
      select: { version: true, downloadUrl: true },
    });
    const { subject, html } = buildConfirmedEmail({
      recipientName: updated.name,
      productName: current.firmwareProduct.name,
      productModel: current.firmwareProduct.model,
      token: updated.token,
      latestVersion: latest?.version ?? null,
      latestDownloadUrl: latest?.downloadUrl ?? null,
    });
    await sendEmail({ to: updated.email, subject, html });
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  await prisma.firmwareRegistration.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
