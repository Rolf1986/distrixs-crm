import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { CreditNotePdf } from "@/components/pdf/CreditNotePdf";
import { buildCreditNotePdfData } from "@/lib/pdf-data";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const built = await buildCreditNotePdfData(id);
  if (!built) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  // Nummer kan slashes/spaties bevatten (bv. "CN-2026-2026 / 24") → veilig maken
  const safeName = built.data.creditNoteNumber.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");

  try {
    const element = createElement(CreditNotePdf, { data: built.data });
    const buffer = await renderToBuffer(element as never);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Creditnota PDF fout:", err);
    return NextResponse.json({ error: "PDF generatie mislukt", detail: String(err) }, { status: 500 });
  }
}
