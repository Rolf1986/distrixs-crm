/**
 * Shared recalculation helpers for VAT-per-line totals.
 * Netherlands VAT rates: 0%, 9%, 21%.
 */

export type VatBreakdownEntry = {
  rate: number;
  base: number;
  vat: number;
};

export type TotalsResult = {
  subtotal: number;
  vatBreakdown: VatBreakdownEntry[];
  vatAmount: number;
  total: number;
};

/**
 * Calculate per-line VAT amount.
 * vatAmount = netLineTotal * (vatRate / 100)
 */
export function calcLineVat(netLineTotal: number, vatRate: number): number {
  return netLineTotal * (vatRate / 100);
}

/**
 * Group lines by vatRate, sum per group, and return totals.
 * subtotal  = sum of all netLineTotals
 * vatAmount = sum of all per-line vatAmounts (correct multi-rate grouping)
 * total     = subtotal + vatAmount
 */
export function calcTotals(
  lines: { netLineTotal: number; vatRate: number }[]
): TotalsResult {
  const subtotal = lines.reduce((s, l) => s + l.netLineTotal, 0);

  // Accumulate per rate group
  const groupMap = new Map<number, { base: number; vat: number }>();
  for (const l of lines) {
    const rate = l.vatRate;
    const lineVat = calcLineVat(l.netLineTotal, rate);
    const existing = groupMap.get(rate) ?? { base: 0, vat: 0 };
    groupMap.set(rate, {
      base: existing.base + l.netLineTotal,
      vat: existing.vat + lineVat,
    });
  }

  const vatBreakdown: VatBreakdownEntry[] = Array.from(groupMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, { base, vat }]) => ({ rate, base, vat }));

  const vatAmount = vatBreakdown.reduce((s, g) => s + g.vat, 0);
  const total = subtotal + vatAmount;

  return { subtotal, vatBreakdown, vatAmount, total };
}
