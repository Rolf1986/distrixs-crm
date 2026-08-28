import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/components/pdf/InvoicePdf";
import { buildInvoicePdfData } from "@/lib/pdf-data";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;

  // Gedeelde databouwer — zelfde inhoud (incl. betalingsschema) als de
  // PDF die per mail wordt verstuurd
  const built = await buildInvoicePdfData(id);
  if (!built) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  try {
    const element = createElement(InvoicePdf, { data: built.data });
    const buffer = await renderToBuffer(element as never);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${built.invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Invoice PDF fout:", err);
    return NextResponse.json({ error: "PDF generatie mislukt", detail: String(err) }, { status: 500 });
  }
}
