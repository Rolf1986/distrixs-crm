/**
 * Margeberekening voor Distrixs CRM
 * China-opslag: ~8% shipping + ~6% invoerrechten (configureerbaar)
 */

const CHINA_SHIPPING_FACTOR = 0.08;
const CHINA_IMPORT_DUTIES_FACTOR = 0.06;

export interface MarginResult {
  expectedMargin: number;
  expectedMarginPct: number;
  chinaCost: number;
}

export function calcExpectedMargin(
  salePrice: number,
  baseCostPrice: number,
  isChina = false
): MarginResult {
  const chinaCost = isChina
    ? baseCostPrice * (CHINA_SHIPPING_FACTOR + CHINA_IMPORT_DUTIES_FACTOR)
    : 0;
  const totalCost = baseCostPrice + chinaCost;
  const expectedMargin = salePrice - totalCost;
  const expectedMarginPct = salePrice > 0 ? (expectedMargin / salePrice) * 100 : 0;
  return { expectedMargin, expectedMarginPct, chinaCost };
}

export function calcRealMargin(
  salePrice: number,
  actualCost: number
): { realMargin: number; realMarginPct: number } {
  const realMargin = salePrice - actualCost;
  const realMarginPct = salePrice > 0 ? (realMargin / salePrice) * 100 : 0;
  return { realMargin, realMarginPct };
}
