import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await req.json();
  const {
    companyName, kvkNumber, vatNumber, defaultPaymentTerm, defaultLanguage, status, email,
    address, contact,
  } = body as {
    companyName?: string;
    kvkNumber?: string | null;
    vatNumber?: string | null;
    defaultPaymentTerm?: string;
    defaultLanguage?: string;
    status?: string;
    email?: string | null;
    address?: { street?: string; houseNumber?: string; postalCode?: string; city?: string; country?: string } | null;
    contact?: { firstName?: string; lastName?: string; email?: string; phone?: string } | null;
  };

  if (!companyName?.trim()) return NextResponse.json({ error: "Bedrijfsnaam verplicht" }, { status: 400 });

  // Klantnummer K-YYYY-NNNN: numeriek hoogste + 1 (string-sortering geeft fout nummer)
  const year = new Date().getFullYear();
  const prefix = `K-${year}-`;
  const existing = await prisma.customer.findMany({
    where: { customerNumber: { startsWith: prefix } },
    select: { customerNumber: true },
  });
  let maxSeq = 0;
  for (const c of existing) {
    const n = parseInt(c.customerNumber.slice(prefix.length), 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }

  const hasAddress = address && address.street?.trim() && address.city?.trim();
  const hasContact = contact && (contact.firstName?.trim() || contact.lastName?.trim());

  // Retry bij een gelijktijdige aanmaak / bezet nummer
  for (let attempt = 0; attempt < 5; attempt++) {
    const customerNumber = `${prefix}${String(maxSeq + 1 + attempt).padStart(4, "0")}`;
    try {
      const customer = await prisma.customer.create({
        data: {
          customerNumber,
          companyName: companyName.trim(),
          kvkNumber: kvkNumber?.trim() || null,
          vatNumber: vatNumber?.trim() || null,
          email: email?.trim() || null,
          defaultPaymentTerm: (defaultPaymentTerm as never) || "DAYS_14",
          defaultLanguage: defaultLanguage === "EN" ? "EN" : "NL",
          status: (status as never) || "ACTIVE",
          ...(hasAddress
            ? {
                addresses: {
                  create: {
                    type: "BILLING",
                    isDefault: true,
                    street: address!.street!.trim(),
                    houseNumber: address!.houseNumber?.trim() || "",
                    postalCode: address!.postalCode?.trim() || "",
                    city: address!.city!.trim(),
                    country: address!.country?.trim() || "NL",
                  },
                },
              }
            : {}),
          ...(hasContact
            ? {
                contacts: {
                  create: {
                    firstName: contact!.firstName?.trim() || "",
                    lastName: contact!.lastName?.trim() || "",
                    email: contact!.email?.trim() || null,
                    phone: contact!.phone?.trim() || null,
                    isPrimary: true,
                    isActive: true,
                  },
                },
              }
            : {}),
        },
      });
      return NextResponse.json({ id: customer.id, customerNumber: customer.customerNumber });
    } catch (e) {
      // Uniek nummer bezet (P2002) → volgende nummer proberen
      if ((e as { code?: string })?.code === "P2002") continue;
      console.error("[customers] aanmaken mislukt:", e);
      return NextResponse.json({ error: "Aanmaken mislukt" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Kon geen vrij klantnummer bepalen, probeer opnieuw" }, { status: 409 });
}
