/**
 * Nummer-formatteerders voor Distrixs CRM
 * Deal: D-YYYY-001 · Quote: Q-YYYY-001 · Invoice: F-YYYY-001 · PO: PO-YYYY-001
 */

export function formatDealNumber(year: number, seq: number): string {
  return `D-${year}-${String(seq).padStart(3, "0")}`;
}

export function formatQuoteNumber(year: number, seq: number): string {
  return `Q-${year}-${String(seq).padStart(3, "0")}`;
}

export function formatInvoiceNumber(year: number, seq: number): string {
  return `F-${year}-${String(seq).padStart(3, "0")}`;
}

export function formatPoNumber(year: number, seq: number): string {
  return `PO-${year}-${String(seq).padStart(3, "0")}`;
}

export function formatRmaNumber(year: number, seq: number): string {
  return `RMA-${year}-${String(seq).padStart(3, "0")}`;
}

export function formatOrderConfirmationNumber(year: number, seq: number): string {
  return `OB-${year}-${String(seq).padStart(3, "0")}`;
}

export function formatDeliveryNoteNumber(year: number, seq: number): string {
  return `VD-${year}-${String(seq).padStart(3, "0")}`;
}
