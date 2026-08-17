export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ProductsClient, type FirmwareProductRow, type CrmProductOption } from "./ProductsClient";

export default async function FirmwareProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: focusProductId } = await searchParams;
  const [firmwareProducts, crmProducts] = await Promise.all([
    prisma.firmwareProduct.findMany({
      include: {
        releases: {
          orderBy: [{ releaseDate: "desc" }, { firstSeenAt: "desc" }],
          take: 1,
          select: { version: true, releaseDate: true },
        },
        links: {
          include: { product: { select: { id: true, sku: true, title: true } } },
        },
        _count: { select: { releases: true, registrations: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const rows: FirmwareProductRow[] = firmwareProducts.map((p) => ({
    id: p.id,
    label: p.model && p.model !== p.name ? `${p.name} (${p.model})` : p.name,
    releaseCount: p._count.releases,
    latestVersion: p.releases[0]?.version ?? null,
    latestDate:
      p.releases[0]?.releaseDate?.toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) ?? null,
    registrationCount: p._count.registrations,
    links: p.links.map((l) => ({
      id: l.id,
      productId: l.product.id,
      sku: l.product.sku,
      title: l.product.title,
      isSuggested: l.isSuggested,
    })),
  }));

  const options: CrmProductOption[] = crmProducts.map((p) => ({ id: p.id, sku: p.sku, title: p.title }));

  // Vanuit de releaselijst kom je hier met ?product=… — dan zoeken we die alvast op.
  const initialQuery = focusProductId
    ? (firmwareProducts.find((p) => p.id === focusProductId)?.name ?? "")
    : "";

  return <ProductsClient firmwareProducts={rows} crmProducts={options} initialQuery={initialQuery} />;
}
