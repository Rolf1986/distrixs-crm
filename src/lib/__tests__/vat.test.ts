import { describe, it, expect } from "vitest";
import {
  normalizeVatNumber,
  normalizeCountry,
  isEuReverseCharge,
  defaultVatRateForCustomer,
} from "@/lib/vat";

describe("normalizeVatNumber", () => {
  it("strips puntjes en spaties uit Belgische nummers", () => {
    expect(normalizeVatNumber("BE 0123.456.789")).toBe("BE0123456789");
  });
  it("maakt uppercase", () => {
    expect(normalizeVatNumber("nl001234567b01")).toBe("NL001234567B01");
  });
  it("geeft null voor leeg/null", () => {
    expect(normalizeVatNumber(null)).toBeNull();
    expect(normalizeVatNumber("")).toBeNull();
    expect(normalizeVatNumber(" .-")).toBeNull();
  });
});

describe("isEuReverseCharge (ICL)", () => {
  it("EU-land buiten NL mét btw-nummer → verlegd", () => {
    expect(isEuReverseCharge("BE", "BE0123456789")).toBe(true);
    expect(isEuReverseCharge("België", "BE0123456789")).toBe(true);
  });
  it("zonder btw-nummer géén verlegging", () => {
    expect(isEuReverseCharge("BE", null)).toBe(false);
    expect(isEuReverseCharge("BE", "  ")).toBe(false);
  });
  it("NL nooit verlegd, ook met btw-nummer", () => {
    expect(isEuReverseCharge("NL", "NL001234567B01")).toBe(false);
    expect(isEuReverseCharge(null, "NL001234567B01")).toBe(false);
  });
  it("niet-EU nooit verlegd", () => {
    expect(isEuReverseCharge("CH", "CHE123456789")).toBe(false);
    expect(isEuReverseCharge("US", "123")).toBe(false);
  });
});

describe("defaultVatRateForCustomer", () => {
  it("0% bij ICL, anders 21%", () => {
    expect(defaultVatRateForCustomer("BE", "BE0123456789")).toBe(0);
    expect(defaultVatRateForCustomer("BE", null)).toBe(21);
    expect(defaultVatRateForCustomer("NL", "NL001234567B01")).toBe(21);
  });
});

describe("normalizeCountry", () => {
  it("landnamen naar codes, default NL", () => {
    expect(normalizeCountry("Nederland")).toBe("NL");
    expect(normalizeCountry(null)).toBe("NL");
    expect(normalizeCountry("be")).toBe("BE");
  });
});
