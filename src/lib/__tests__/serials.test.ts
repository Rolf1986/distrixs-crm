import { describe, it, expect } from "vitest";
import { parseSerialNumbers, normalizeSerialNumbers } from "@/lib/serials";

describe("parseSerialNumbers", () => {
  it("accepteert regels, komma's, puntkomma's en tabs (Excel)", () => {
    expect(parseSerialNumbers("A1\nA2")).toEqual(["A1", "A2"]);
    expect(parseSerialNumbers("A1, A2; A3\tA4")).toEqual(["A1", "A2", "A3", "A4"]);
  });
  it("behoudt volgorde en verwijdert duplicaten en lege regels", () => {
    expect(parseSerialNumbers("B2\n\nA1\nB2\n  ")).toEqual(["B2", "A1"]);
  });
  it("laat spaties binnen een nummer intact (alleen 2+ spaties splitst)", () => {
    expect(parseSerialNumbers("SN 001\nSN 002")).toEqual(["SN 001", "SN 002"]);
    expect(parseSerialNumbers("SN001  SN002")).toEqual(["SN001", "SN002"]);
  });
  it("leeg → lege lijst / null", () => {
    expect(parseSerialNumbers(null)).toEqual([]);
    expect(normalizeSerialNumbers("  ,\n; ")).toBeNull();
  });
  it("normaliseert naar één per regel", () => {
    expect(normalizeSerialNumbers("A1, A2")).toBe("A1\nA2");
  });
  it("stript leverancierslabels zoals 'Batch Code:' en 'S/N'", () => {
    expect(
      parseSerialNumbers("Batch Code: AE-032605730\nAE-032605729\nBatch Code: AE-032605706\nS/N: X1")
    ).toEqual(["AE-032605730", "AE-032605729", "AE-032605706", "X1"]);
  });
});
