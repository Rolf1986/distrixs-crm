import type { SupplierType } from "@/generated/prisma";

// Default China overhead estimates (configurable later via settings)
export const CHINA_SHIPPING_ESTIMATE_PCT = 0.08; // 8%
export const CHINA_IMPORT_DUTIES_ESTIMATE_PCT = 0.06; // 6%

export function calcExpectedCost(
  baseCostPrice: number,
  qty: number,
  supplierType: SupplierType
): number {
  const base = baseCostPrice * qty;
  if (supplierType !== "CHINA") return base;
  return base * (1 + CHINA_SHIPPING_ESTIMATE_PCT + CHINA_IMPORT_DUTIES_ESTIMATE_PCT);
}

export function calcExpectedMargin(netLineTotal: number, expectedCostTotal: number): number {
  return netLineTotal - expectedCostTotal;
}

export function calcRealMargin(netLineTotal: number, realCostTotal: number): number {
  return netLineTotal - realCostTotal;
}

export function calcMarginPct(margin: number, revenue: number): number {
  if (revenue === 0) return 0;
  return (margin / revenue) * 100;
}
