import type { Deal, DealLine, Quote, QuoteLine } from "@/generated/prisma";

/**
 * Generates the next sequential number for quotes: Q-YYYY-001
 */
export function generateQuoteNumber(year: number, sequence: number): string {
  return `Q-${year}-${String(sequence).padStart(3, "0")}`;
}

/**
 * Generates the next sequential invoice number: F-YYYY-001
 */
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `F-${year}-${String(sequence).padStart(3, "0")}`;
}

/**
 * Generates a deal number: D-YYYY-001
 */
export function generateDealNumber(year: number, sequence: number): string {
  return `D-${year}-${String(sequence).padStart(3, "0")}`;
}

/**
 * Generates a PO number: PO-YYYY-001
 */
export function generatePoNumber(year: number, sequence: number): string {
  return `PO-${year}-${String(sequence).padStart(3, "0")}`;
}
