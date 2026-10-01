import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { OrderConfirmationPdf } from "@/components/pdf/OrderConfirmationPdf";
import { buildOrderConfirmationPdfData } from "@/lib/pdf-data";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  // Zelfde databouw als eventuele andere afnemers (KWAL-06: één bron)
  const built = await buildOrderConfirmationPdfData(id);
  if (!built) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  try {
    const element = createElement(OrderConfirmationPdf, { data: built.data });
    const buffer = await renderToBuffer(element as never);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${built.oc.confirmationNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[oc pdf]", err);
    return NextResponse.json({ error: "PDF genereren mislukt" }, { status: 500 });
  }
}
