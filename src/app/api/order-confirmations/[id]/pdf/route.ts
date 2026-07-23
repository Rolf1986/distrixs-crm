import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { OrderConfirmationPdf } from "@/components/pdf/OrderConfirmationPdf";
import { getCompanyInfo } from "@/lib/companySettings";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  const oc = await prisma.orderConfirmation.findUnique({
    where: { id },
    include: {
      deal: { select: { title: true, orderReference: true } },
      quote: {
        select: {
          quoteNumber: true,
          language: true,
          subtotal: true,
          vatAmount: true,
          total: true,
          lines: { orderBy: { createdAt: "asc" } },
        },
      },
      customer: {
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
          contacts: { where: { isPrimary: true, isActive: true }, take: 1 },
        },
      },
    },
  });

  if (!oc) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  const company = await getCompanyInfo();
  const addr =
    oc.customer.addresses.find((a) => a.type === "BILLING" && a.isDefault) ??
    oc.customer.addresses[0];
  const contact = oc.customer.contacts[0];

  // Leverdatum per regel (quoteLineId → ISO-datum)
  const lineDeliveries = (oc.lineDeliveries ?? {}) as Record<string, string>;

  const data = {
    language: oc.quote?.language ?? "NL",
    confirmationNumber: oc.confirmationNumber,
    confirmationDate: oc.confirmationDate,
    expectedDelivery: oc.expectedDelivery,
    projectName: oc.deal?.title ?? null,
    customerReference: oc.deal?.orderReference ?? null,
    quoteNumber: oc.quote?.quoteNumber ?? null,
    notes: oc.notes ?? null,
    subtotal: Number(oc.quote?.subtotal ?? 0),
    vatAmount: Number(oc.quote?.vatAmount ?? 0),
    total: Number(oc.quote?.total ?? 0),
    company,
    customer: {
      companyName: oc.customer.companyName,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      address: addr ? `${addr.street} ${addr.houseNumber}`.trim() : null,
      postalCode: addr?.postalCode ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
    },
    lines: (oc.quote?.lines ?? []).map((l) => ({
      skuSnapshot: l.skuSnapshot,
      titleSnapshot: l.titleSnapshot,
      qty: Number(l.qty),
      grossUnitPrice: Number(l.grossUnitPrice),
      discountPercent: Number(l.discountPercent),
      netLineTotal: Number(l.netLineTotal),
      deliveryDate: lineDeliveries[l.id] ?? null,
    })),
  };

  try {
    const element = createElement(OrderConfirmationPdf, { data });
    const buffer = await renderToBuffer(element as never);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${oc.confirmationNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[oc pdf]", err);
    return NextResponse.json({ error: "PDF genereren mislukt" }, { status: 500 });
  }
}
