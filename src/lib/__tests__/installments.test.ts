import { describe, it, expect, vi } from "vitest";

// installments.ts importeert de Prisma-client; voor deze pure-functie-tests
// mocken we die weg (geen database nodig).
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { installmentAmount } from "@/lib/installments";

describe("installmentAmount", () => {
  it("vast bedrag wint van percentage", () => {
    expect(installmentAmount({ amount: 250, percentage: 50 }, 1000)).toBe(250);
  });
  it("percentage van het factuurtotaal, afgerond op centen", () => {
    expect(installmentAmount({ amount: null, percentage: 50 }, 999.99)).toBe(500);
    expect(installmentAmount({ amount: null, percentage: 30 }, 1000)).toBe(300);
    expect(installmentAmount({ amount: null, percentage: 33.33 }, 100)).toBe(33.33);
  });
  it("geen percentage → 0", () => {
    expect(installmentAmount({ amount: null, percentage: null }, 1000)).toBe(0);
  });
});
