import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { recalcInvoicePaymentState } from "@/lib/payment-state";

// Nep-db die het Db-interface van payment-state nabootst
function fakeDb(invoice: { total: number; status: string }, amounts: number[]) {
  const updates: Record<string, unknown>[] = [];
  return {
    updates,
    invoice: {
      findUniqueOrThrow: async () => invoice,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return data;
      },
    },
    payment: {
      findMany: async () => amounts.map((a) => ({ amount: a })),
    },
  };
}

describe("recalcInvoicePaymentState", () => {
  it("volledig betaald → PAID, open 0", async () => {
    const db = fakeDb({ total: 100, status: "SENT" }, [60, 40]);
    const r = await recalcInvoicePaymentState("x", db as never);
    expect(r).toEqual({ paidAmount: 100, openAmount: 0, status: "PAID" });
  });

  it("1 cent float-residu telt als betaald (open wordt 0)", async () => {
    const db = fakeDb({ total: 100, status: "SENT" }, [33.33, 33.33, 33.33]);
    const r = await recalcInvoicePaymentState("x", db as never);
    expect(r.status).toBe("PAID");
    expect(r.openAmount).toBe(0);
    expect(r.paidAmount).toBeCloseTo(99.99, 10);
  });

  it("deels betaald → PARTIALLY_PAID, ook vanuit OVERDUE", async () => {
    const db = fakeDb({ total: 100, status: "OVERDUE" }, [25]);
    const r = await recalcInvoicePaymentState("x", db as never);
    expect(r).toEqual({ paidAmount: 25, openAmount: 75, status: "PARTIALLY_PAID" });
  });

  it("laatste betaling verwijderd → terug naar SENT", async () => {
    const db = fakeDb({ total: 100, status: "PAID" }, []);
    const r = await recalcInvoicePaymentState("x", db as never);
    expect(r).toEqual({ paidAmount: 0, openAmount: 100, status: "SENT" });
  });

  it("DRAFT en CREDITED behouden hun status", async () => {
    const d = await recalcInvoicePaymentState("x", fakeDb({ total: 100, status: "DRAFT" }, [100]) as never);
    expect(d.status).toBe("DRAFT");
    const c = await recalcInvoicePaymentState("x", fakeDb({ total: 100, status: "CREDITED" }, [100]) as never);
    expect(c.status).toBe("CREDITED");
  });

  it("te veel betaald clampt open op 0", async () => {
    const r = await recalcInvoicePaymentState("x", fakeDb({ total: 100, status: "SENT" }, [150]) as never);
    expect(r).toEqual({ paidAmount: 150, openAmount: 0, status: "PAID" });
  });
});
