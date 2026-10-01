import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { syncInvoiceInstallments } from "@/lib/installments";

// Eén plek voor de betaalstand van een factuur. Voorheen stond deze
// herberekening op vijf plekken (betaling toevoegen/verwijderen, status-
// wijziging, creditnota-verrekening, Mollie-webhook) met subtiel afwijkend
// gedrag: wel/niet afronden op centen, drempel <=0 vs <=0.01, en het
// Mollie-pad synchroniseerde als enige de termijnen niet (REVIEW KWAL-02).

type Db = Prisma.TransactionClient | typeof prisma;

// Float-residu uit Decimal→Number-optellingen: tot 1 cent verschil telt als
// volledig betaald, en we tonen dan ook 0 open (niet € 0,01).
const CENT_TOLERANCE = 0.01;

const roundCents = (n: number) => Math.round(n * 100) / 100;

/** Som van alle geregistreerde betalingen, afgerond op centen. */
export async function sumInvoicePayments(invoiceId: string, tx?: Db): Promise<number> {
  const db = tx ?? prisma;
  const payments = await db.payment.findMany({
    where: { invoiceId },
    select: { amount: true },
  });
  return roundCents(payments.reduce((s, p) => s + Number(p.amount), 0));
}

export interface InvoicePaymentState {
  paidAmount: number;
  openAmount: number;
  status: string;
}

/**
 * Herbereken paidAmount/openAmount/status van een factuur uit de werkelijk
 * geregistreerde betalingen, en schrijf het resultaat naar de factuur.
 *
 * Statusregels:
 * - DRAFT en CREDITED worden nooit aangeraakt (alleen bedragen bijgewerkt);
 * - volledig betaald (open ≤ 1 cent) → PAID;
 * - deels betaald → PARTIALLY_PAID (ook vanuit OVERDUE — bestaand gedrag);
 * - betalingen terug naar 0 vanuit PAID/PARTIALLY_PAID → SENT.
 *
 * Geef `tx` mee om binnen een transactie te draaien. De termijn-sync
 * (vinkjes + vervaldatum) gebruikt de globale client en hoort dáárom ná de
 * commit: roep `syncInvoiceInstallments` zelf aan, of gebruik
 * `recalcInvoicePaymentStateWithInstallments` buiten een transactie.
 */
export async function recalcInvoicePaymentState(
  invoiceId: string,
  tx?: Db
): Promise<InvoicePaymentState> {
  const db = tx ?? prisma;

  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { total: true, status: true },
  });

  const paidAmount = await sumInvoicePayments(invoiceId, db);
  const total = Number(invoice.total);
  let openAmount = Math.max(0, roundCents(total - paidAmount));
  const fullyPaid = openAmount <= CENT_TOLERANCE;
  if (fullyPaid) openAmount = 0;

  let status = invoice.status;
  if (invoice.status !== "DRAFT" && invoice.status !== "CREDITED") {
    if (fullyPaid) {
      status = "PAID";
    } else if (paidAmount > 0) {
      status = "PARTIALLY_PAID";
    } else if (invoice.status === "PAID" || invoice.status === "PARTIALLY_PAID") {
      status = "SENT";
    }
  }

  await db.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount, openAmount, status },
  });

  return { paidAmount, openAmount, status };
}

/** Herberekening + termijn-sync in één aanroep (alleen buiten transacties). */
export async function recalcInvoicePaymentStateWithInstallments(
  invoiceId: string
): Promise<InvoicePaymentState> {
  const state = await recalcInvoicePaymentState(invoiceId);
  await syncInvoiceInstallments(invoiceId);
  return state;
}
