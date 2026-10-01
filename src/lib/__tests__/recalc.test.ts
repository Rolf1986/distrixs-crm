import { describe, it, expect } from "vitest";
import { calcLineVat, calcTotals } from "@/lib/recalc";
import { calcNetLineTotal } from "@/lib/pricing";
import { termDays, TERM_DAYS } from "@/lib/payment-terms";
import { calcExpectedMargin, calcRealMargin, CHINA_COST_MULTIPLIER } from "@/lib/margin";

describe("calcLineVat", () => {
  it("21% over netto regeltotaal", () => {
    expect(calcLineVat(100, 21)).toBeCloseTo(21, 10);
    expect(calcLineVat(100, 0)).toBe(0);
  });
});

describe("calcTotals", () => {
  it("groepeert per btw-tarief", () => {
    const r = calcTotals([
      { netLineTotal: 100, vatRate: 21 },
      { netLineTotal: 50, vatRate: 21 },
      { netLineTotal: 200, vatRate: 0 },
    ]);
    expect(r.subtotal).toBe(350);
    expect(r.vatAmount).toBeCloseTo(31.5, 10);
    expect(r.total).toBeCloseTo(381.5, 10);
    expect(r.vatBreakdown).toEqual([
      { rate: 0, base: 200, vat: 0 },
      { rate: 21, base: 150, vat: expect.closeTo(31.5, 10) },
    ]);
  });
  it("negatieve (kortings)regels tellen mee", () => {
    const r = calcTotals([
      { netLineTotal: 100, vatRate: 21 },
      { netLineTotal: -20, vatRate: 21 },
    ]);
    expect(r.subtotal).toBe(80);
    expect(r.total).toBeCloseTo(96.8, 10);
  });
  it("lege lijst → nullen", () => {
    const r = calcTotals([]);
    expect(r).toEqual({ subtotal: 0, vatBreakdown: [], vatAmount: 0, total: 0 });
  });
});

describe("calcNetLineTotal", () => {
  it("korting op bruto stukprijs × aantal", () => {
    expect(calcNetLineTotal(100, 2, 10)).toBeCloseTo(180, 10);
    expect(calcNetLineTotal(59.5, 1, 0)).toBe(59.5);
  });
});

describe("termDays", () => {
  it("kent alle termijnen en valt terug op 14", () => {
    expect(termDays("DAYS_14")).toBe(14);
    expect(termDays("DAYS_30")).toBe(30);
    expect(termDays("PREPAYMENT")).toBe(0);
    expect(termDays("INSTALLMENTS")).toBe(TERM_DAYS.INSTALLMENTS);
    expect(termDays(null)).toBe(14);
    expect(termDays("ONBEKEND")).toBe(14);
  });
});

describe("marge (China +8% shipping +6% invoerrechten)", () => {
  it("China-opslag over de inkoopprijs", () => {
    const r = calcExpectedMargin(1000, 500, true);
    expect(r.chinaCost).toBeCloseTo(70, 10); // 14% van 500
    expect(r.expectedMargin).toBeCloseTo(1000 - 500 * CHINA_COST_MULTIPLIER, 10);
    expect(r.expectedMarginPct).toBeCloseTo(43, 10);
  });
  it("zonder China geen opslag", () => {
    const r = calcExpectedMargin(1000, 500, false);
    expect(r.chinaCost).toBe(0);
    expect(r.expectedMargin).toBe(500);
  });
  it("echte marge + deling door nul beschermd", () => {
    expect(calcRealMargin(100, 60)).toEqual({ realMargin: 40, realMarginPct: 40 });
    expect(calcRealMargin(0, 60).realMarginPct).toBe(0);
  });
});
