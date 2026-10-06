import type { Product, ProductPriceTier, Supplier } from "@/generated/prisma";
import { resolveUnitPrice, calcNetLineTotal } from "@/lib/pricing";
import { CHINA_COST_MULTIPLIER } from "@/lib/margin";

type ProductForLine = Pick<Product, "sku" | "title" | "advisorySellPrice" | "baseCostPrice"> & {
  supplier: Pick<Supplier, "id" | "supplierType">;
  priceTiers: ProductPriceTier[];
};

/**
 * Rekent een dealregel uit (staffelprijs, korting, verwachte kosten/marge incl. China-opslag)
 * en geeft de velden terug voor prisma.dealLine.create — zonder dealId/productId.
 */
export function buildDealLineData(
  product: ProductForLine,
  qty: number,
  opts: { grossUnitPriceOverride?: number | null; discountPercent?: number } = {}
) {
  const grossUnitPrice =
    opts.grossUnitPriceOverride != null
      ? Number(opts.grossUnitPriceOverride)
      : resolveUnitPrice(qty, Number(product.advisorySellPrice), product.priceTiers);

  const discountPct = Number(opts.discountPercent ?? 0);
  const netLineTotal = calcNetLineTotal(grossUnitPrice, qty, discountPct);

  const isChina = product.supplier.supplierType === "CHINA";
  const baseCostPerUnit = Number(product.baseCostPrice);

  const chinaFactor = isChina ? CHINA_COST_MULTIPLIER : 1;
  const expectedCostTotal = baseCostPerUnit * chinaFactor * qty;

  return {
    skuSnapshot: product.sku,
    titleSnapshot: product.title,
    supplierIdSnapshot: product.supplier.id,
    supplierTypeSnapshot: product.supplier.supplierType,
    qty,
    grossUnitPrice,
    discountPercent: discountPct,
    netLineTotal,
    baseCostSnapshot: baseCostPerUnit,
    expectedCostTotal,
    expectedMarginTotal: netLineTotal - expectedCostTotal,
  };
}
