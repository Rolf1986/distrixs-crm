import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit, clientIpFromRequest } from "@/lib/audit";

// AVG-verwijderverzoek (PRIV-02): persoonsgegevens wissen, zakelijke gegevens
// behouden. Facturen/offertes moeten 7 jaar blijven (fiscale bewaarplicht),
// maar namen, e-mailadressen, telefoonnummers, notities, mails en
// interactiehistorie niet. Onomkeerbaar.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, companyName: true, anonymizedAt: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  }
  if (customer.anonymizedAt) {
    return NextResponse.json({ error: "Deze klant is al geanonimiseerd." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const contacts = await tx.customerContact.updateMany({
      where: { customerId: id },
      data: {
        firstName: "Geanonimiseerd",
        lastName: "contact",
        email: null,
        phone: null,
        roleOrFunction: null,
        isActive: false,
        externalId: null,
      },
    });

    // Interactiehistorie en mailkopieën bevatten vrije tekst met persoonsdata
    const emails = await tx.email.deleteMany({ where: { customerId: id } });
    const activities = await tx.activity.deleteMany({ where: { customerId: id } });

    // RMA's: ingevulde persoonsgegevens wissen, de zaak zelf blijft (PRIV-12)
    const rmas = await tx.rma.updateMany({
      where: { customerId: id },
      data: {
        submittedName: "Geanonimiseerd",
        submittedEmail: "geanonimiseerd@avg.invalid",
        submittedPhone: null,
      },
    });

    // Leads die naar deze klant zijn geconverteerd
    const leads = await tx.lead.updateMany({
      where: { convertedToCustomerId: id },
      data: { contactName: null, email: null, phone: null, notes: null },
    });

    await tx.customer.update({
      where: { id },
      data: { email: null, notes: null, anonymizedAt: new Date() },
    });

    return {
      contacten: contacts.count,
      mails: emails.count,
      activiteiten: activities.count,
      rmas: rmas.count,
      leads: leads.count,
    };
  });

  await logAudit({
    userId: session.user.id,
    action: "customer.anonymized",
    entityType: "Customer",
    entityId: id,
    newValue: { companyName: customer.companyName, ...result },
    ip: clientIpFromRequest(req),
  });

  return NextResponse.json({ ok: true, ...result });
}
