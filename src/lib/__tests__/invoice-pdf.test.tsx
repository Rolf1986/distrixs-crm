import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/components/pdf/InvoicePdf";

// Smoke-test: de factuur-PDF rendert zonder fouten, zowel met inline
// serienummers (≤24) als met de automatische bijlagepagina (>24).
function baseData(serials: string[]) {
  return {
    language: "NL",
    invoiceNumber: "2026 / 999",
    invoiceDate: new Date("2026-10-02"),
    dueDate: new Date("2026-10-16"),
    subtotal: 100,
    vatAmount: 21,
    total: 121,
    reverseCharge: false,
    company: { name: "Distrixs B.V." },
    customer: { companyName: "Testklant B.V." },
    lines: [
      {
        skuSnapshot: "TEST-1",
        titleSnapshot: "Testproduct",
        qty: serials.length || 1,
        grossUnitPrice: 100,
        discountPercent: 0,
        netLineTotal: 100,
        serialNumbers: serials,
      },
    ],
  } as never;
}

describe("InvoicePdf met serienummers", () => {
  it("rendert inline (≤24 nummers)", async () => {
    const buf = await renderToBuffer(
      createElement(InvoicePdf, { data: baseData(["SN-001", "SN-002", "SN-003"]) }) as never
    );
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("rendert bijlagepagina (>24 nummers)", async () => {
    const many = Array.from({ length: 60 }, (_, i) => `SN-${String(i + 1).padStart(4, "0")}`);
    const buf = await renderToBuffer(
      createElement(InvoicePdf, { data: baseData(many) }) as never
    );
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
