// Eén bron voor betaaltermijn → dagen (voorheen op 5 plekken gedupliceerd,
// met uiteenlopende fallbacks — review KWAL-03).
export const TERM_DAYS: Record<string, number> = {
  DAYS_14: 14,
  DAYS_30: 30,
  PREPAYMENT: 0,
  INSTALLMENTS: 30,
};

export const DEFAULT_TERM_DAYS = 14;

export function termDays(paymentTermType: string | null | undefined): number {
  return TERM_DAYS[paymentTermType ?? ""] ?? DEFAULT_TERM_DAYS;
}
