import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { DeliveryNotePdf } from "@/components/pdf/DeliveryNotePdf";
import { getCompanyInfo } from "@/lib/companySettings";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  const dn = await prisma.deliveryNote.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          addresses: {
            where: { isDefault: true },
            orderBy: { type: "asc" },
            take: 2,
          },
        },
      },
      contact: true,
      lines: { orderBy: { createdAt: "asc" } },
      deal: { select: { language: false } as never },
    },
  });

  if (!dn) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const company = await getCompanyInfo();

  const billingAddr = dn.customer.addresses.find(a => a.type === "BILLING");
  const shippingAddr = dn.customer.addresses.find(a => a.type === "SHIPPING");
  const defaultAddr = billingAddr ?? dn.customer.addresses[0];

  const data = {
    language: "NL",
    noteNumber: dn.noteNumber,
    deliveryDate: dn.expectedDelivery ?? new Date(),
    notes: dn.notes,
    company,
    customer: {
      companyName: dn.customer.companyName,
      contactName: dn.contact ? `${dn.contact.firstName} ${dn.contact.lastName}` : null,
      address: defaultAddr ? `${defaultAddr.street} ${defaultAddr.houseNumber}` : null,
      postalCode: defaultAddr?.postalCode ?? null,
      city: defaultAddr?.city ?? null,
      country: defaultAddr?.country ?? null,
    },
    deliveryAddress: shippingAddr ? {
      companyName: dn.customer.companyName,
      address: `${shippingAddr.street} ${shippingAddr.houseNumber}`,
      postalCode: shippingAddr.postalCode,
      city: shippingAddr.city,
      country: shippingAddr.country,
    } : null,
    lines: dn.lines.map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      qty: Number(l.qtyDelivered),
    })),
  };

  try {
    const element = createElement(DeliveryNotePdf, { data });
    const buffer = await renderToBuffer(element as never);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${dn.noteNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Leveringsbon PDF fout:", err);
    return NextResponse.json({ error: "PDF generatie mislukt", detail: String(err) }, { status: 500 });
  }
}
