import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { suggestProductLinks } from "@/lib/firmwareSync";

export const dynamic = "force-dynamic";

/** Koppelingen tussen CRM-artikelen en ACME-firmwareproducten. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const links = await prisma.productFirmwareLink.findMany({
    include: {
      product: { select: { id: true, sku: true, title: true } },
      firmwareProduct: { select: { id: true, name: true, model: true } },
    },
    orderBy: [{ isSuggested: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(links);
}

/**
 * Body { productId, firmwareProductId } koppelt handmatig.
 * Body { autoSuggest: true } laat het systeem voorstellen doen op naamgelijkenis.
 * Body { confirmAll: true } bevestigt alle openstaande voorstellen in één keer.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await req.json();

  if (body.confirmAll) {
    const { count } = await prisma.productFirmwareLink.updateMany({
      where: { isSuggested: true },
      data: { isSuggested: false },
    });
    return NextResponse.json({ confirmed: count });
  }

  if (body.autoSuggest) {
    const created = await suggestProductLinks();
    return NextResponse.json({ suggested: created });
  }

  const { productId, firmwareProductId } = body;
  if (typeof productId !== "string" || typeof firmwareProductId !== "string") {
    return NextResponse.json({ error: "productId en firmwareProductId zijn verplicht" }, { status: 400 });
  }

  const link = await prisma.productFirmwareLink.upsert({
    where: { productId_firmwareProductId: { productId, firmwareProductId } },
    create: { productId, firmwareProductId, isSuggested: false },
    update: { isSuggested: false }, // bevestigen van een voorstel
  });

  return NextResponse.json(link);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ontbreekt" }, { status: 400 });

  await prisma.productFirmwareLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
