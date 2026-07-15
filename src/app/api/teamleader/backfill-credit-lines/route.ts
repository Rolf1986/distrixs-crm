import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { getValidAccessToken } from "@/lib/teamleader-token";
import { fetchCreditNoteInfo, type TLLineItem } from "@/lib/teamleader";

export const maxDuration = 300;

/** TL-regel → CreditNoteLine-velden (positieve grondwaarden). */
function mapLine(item: TLLineItem, productByTlId: Map<string, { id: string; sku: string }>) {
  const qty = Number(item.quantity ?? 0);
  const unit = Number(item.unit_price?.amount ?? 0);
  const excl = Number(item.total?.tax_exclusive?.amount ?? qty * unit);
  const incl = Number(item.total?.tax_inclusive?.amount ?? excl);
  let vatRate = excl > 0.001 ? Math.round(((incl / excl) - 1) * 10000) / 100 : 0;
  for (const known of [0, 6, 9, 21]) {
    if (Math.abs(vatRate - known) < 0.5) { vatRate = known; break; }
  }
  const prod = item.product?.id ? productByTlId.get(item.product.id) : undefined;
  return {
    skuSnapshot: prod?.sku ?? "TL",
    titleSnapshot: (item.description ?? "Regel").slice(0, 500),
    qty,
    unitPrice: unit,
    vatRate,
    excl: Math.round(excl * 100) / 100,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "ADMIN");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Tokenfout" }, { status: 400 });
  }

  // Alle uit Teamleader geïmporteerde creditnota's zonder regels
  const creditNotes = await prisma.creditNote.findMany({
    where: { externalId: { startsWith: "tl-creditnote-" }, lines: { none: {} } },
    select: { id: true, externalId: true, total: true },
  });

  const products = await prisma.product.findMany({
    where: { externalId: { startsWith: "tl-product-" } },
    select: { id: true, sku: true, externalId: true },
  });
  const productByTlId = new Map(
    products.map((p) => [p.externalId!.replace("tl-product-", ""), { id: p.id, sku: p.sku }])
  );

  let filled = 0;
  let empty = 0;
  let failed = 0;

  for (const cn of creditNotes) {
    const tlId = cn.externalId!.replace("tl-creditnote-", "");
    try {
      const info = await fetchCreditNoteInfo(accessToken, tlId);
      const items = (info?.grouped_lines ?? []).flatMap((g) => g.line_items ?? []);
      if (items.length === 0) { empty++; continue; }

      // Teken volgt het bestaande header-totaal (geïmporteerde nota's zijn positief,
      // in het CRM aangemaakte negatief) zodat de nota intern consistent blijft.
      const sign = Number(cn.total) < 0 ? -1 : 1;

      const lines = items.map((it) => {
        const m = mapLine(it, productByTlId);
        const lineTotal = sign * Math.abs(m.excl);
        const vatAmount = Math.round(lineTotal * (m.vatRate / 100) * 100) / 100;
        return {
          creditNoteId: cn.id,
          skuSnapshot: m.skuSnapshot,
          titleSnapshot: m.titleSnapshot,
          qty: m.qty,
          unitPrice: m.unitPrice,
          vatRate: m.vatRate,
          lineTotal,
          vatAmount,
        };
      });

      await prisma.creditNoteLine.createMany({ data: lines });
      filled++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    totaalGevonden: creditNotes.length,
    aangevuld: filled,
    zonderRegelsInTL: empty,
    mislukt: failed,
  });
}
