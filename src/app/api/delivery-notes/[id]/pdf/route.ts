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
      lines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!dn) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const company = await getCompanyInfo();

  const billingAddr = dn.customer.addresses.find(a => a.type === "BILLING");
  const shippingAddr = dn.customer.addresses.find(a => a.type === "SHIPPING");
  const defaultAddr = billingAddr ?? dn.customer.addresses[0];

  const data = {
    language: "NL",
    noteNumber: dn.deliveryNumber,
    deliveryDate: dn.deliveryDate ?? new Date(),
    notes: dn.notes,
    company,
    customer: {
      companyName: dn.customer.companyName,
      contactName: null,
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
      qty: Number(l.qty),
    })),
  };

  try {
    const element = createElement(DeliveryNotePdf, { data });
    const buffer = await renderToBuffer(element as never);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${dn.deliveryNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Leveringsbon PDF fout:", err);
    return NextResponse.json({ error: "PDF generatie mislukt", detail: String(err) }, { status: 500 });
  }
}
