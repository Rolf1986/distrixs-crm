// EU-landcodes (excl. NL) voor intracommunautaire levering / btw-verlegging
export const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "PL", "PT", "RO", "SE", "SI", "SK",
]);

// Veelvoorkomende landnamen → ISO-code (klanten vullen soms een naam in)
const NAME_TO_CODE: Record<string, string> = {
  NEDERLAND: "NL", HOLLAND: "NL", "THE NETHERLANDS": "NL", NETHERLANDS: "NL",
  BELGIE: "BE", "BELGIË": "BE", BELGIUM: "BE", BELGIQUE: "BE",
  DUITSLAND: "DE", GERMANY: "DE", DEUTSCHLAND: "DE",
  FRANKRIJK: "FR", FRANCE: "FR",
  LUXEMBURG: "LU", LUXEMBOURG: "LU",
};

export function normalizeCountry(country: string | null | undefined): string {
  const raw = (country ?? "NL").trim().toUpperCase();
  return NAME_TO_CODE[raw] ?? raw;
}

/**
 * Btw-verlegging (0%) van toepassing? → EU-land (niet NL) mét een ingevuld
 * btw-nummer (zakelijk, intracommunautair). Zonder btw-nummer geldt gewoon NL-btw.
 */
export function isEuReverseCharge(
  country: string | null | undefined,
  vatNumber: string | null | undefined
): boolean {
  const c = normalizeCountry(country);
  return c !== "NL" && EU_COUNTRIES.has(c) && !!vatNumber?.trim();
}

/** Standaard btw-tarief voor een nieuwe regel op basis van de klant. */
export function defaultVatRateForCustomer(
  country: string | null | undefined,
  vatNumber: string | null | undefined
): number {
  return isEuReverseCharge(country, vatNumber) ? 0 : 21;
}
