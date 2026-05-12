/**
 * Atomically generate sequential document numbers using the NumberSequence table.
 * Eliminates the race condition from `findFirst orderBy desc` approaches.
 *
 * Each sequence key is scoped per year, e.g. "invoice-2026", "quote-2026".
 * The DB row is upserted inside a transaction: created with nextVal=1 on first use,
 * or incremented by 1 on subsequent calls — atomically.
 */

import { prisma } from "@/lib/prisma";

async function nextSequence(key: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    // Try to increment an existing row
    const updated = await tx.numberSequence.updateMany({
      where: { id: key },
      data: { nextVal: { increment: 1 } },
    });

    if (updated.count === 0) {
      // Row doesn't exist yet — create it with nextVal = 1
      // Handle concurrent inserts gracefully: if another request wins the
      // insert race we fall back to an update.
      try {
        await tx.numberSequence.create({ data: { id: key, nextVal: 1 } });
        return 1;
      } catch {
        // Unique-constraint violation: another request created the row first
        await tx.numberSequence.updateMany({
          where: { id: key },
          data: { nextVal: { increment: 1 } },
        });
        const row = await tx.numberSequence.findUnique({ where: { id: key } });
        return row!.nextVal;
      }
    }

    const row = await tx.numberSequence.findUnique({ where: { id: key } });
    return row!.nextVal;
  });
}

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

export async function nextInvoiceNumber(year: number): Promise<string> {
  const val = await nextSequence(`invoice-${year}`);
  return `${year} / ${val}`;
}

export async function nextQuoteNumber(year: number): Promise<string> {
  const val = await nextSequence(`quote-${year}`);
  return `Q-${year}-${pad(val)}`;
}

export async function nextCreditNoteNumber(year: number): Promise<string> {
  const val = await nextSequence(`cn-${year}`);
  return `CN-${year}-${pad(val)}`;
}

export async function nextPurchaseOrderNumber(year: number): Promise<string> {
  const val = await nextSequence(`po-${year}`);
  return `PO-${year}-${pad(val)}`;
}

export async function nextDealNumber(year: number): Promise<string> {
  const val = await nextSequence(`deal-${year}`);
  return `D-${year}-${pad(val)}`;
}

export async function nextRmaNumber(year: number): Promise<string> {
  const val = await nextSequence(`rma-${year}`);
  return `RMA-${year}-${pad(val)}`;
}

export async function nextOrderConfirmationNumber(year: number): Promise<string> {
  const val = await nextSequence(`oc-${year}`);
  return `OB-${year}-${pad(val)}`;
}

export async function nextDeliveryNoteNumber(year: number): Promise<string> {
  const val = await nextSequence(`dn-${year}`);
  return `VD-${year}-${pad(val)}`;
}
