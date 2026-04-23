import type { ProductPriceTier } from "@/generated/prisma";

export function resolveUnitPrice(
  qty: number,
  advisorySellPrice: number,
  priceTiers: ProductPriceTier[]
): number {
  if (!priceTiers.length) return advisorySellPrice;

  const sorted = [...priceTiers].sort((a, b) => Number(a.minQty) - Number(b.minQty));
  let resolved = advisorySellPrice;

  for (const tier of sorted) {
    const min = Number(tier.minQty);
    const max = tier.maxQty !== null ? Number(tier.maxQty) : Infinity;
    if (qty >= min && qty <= max) {
      resolved = Number(tier.unitPrice);
      break;
    }
  }

  return resolved;
}

export function calcNetLineTotal(grossUnitPrice: number, qty: number, discountPercent: number): number {
  return grossUnitPrice * qty * (1 - discountPercent / 100);
}
