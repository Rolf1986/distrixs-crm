// Serienummers: gebruikers plakken lijsten in allerlei vormen (één per regel,
// komma's, puntkomma's, tabs uit Excel). We normaliseren naar één per regel.

/** Parse vrije invoer naar een nette lijst serienummers (volgorde behouden, duplicaten weg). */
export function parseSerialNumbers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n\r,;\t]+| {2,}/)) {
    const s = part.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** Normaliseer naar opslagvorm: één serienummer per regel, of null als leeg. */
export function normalizeSerialNumbers(raw: string | null | undefined): string | null {
  const list = parseSerialNumbers(raw);
  return list.length ? list.join("\n") : null;
}

/** Boven dit aantal gaan de nummers naar de bijlagepagina van de PDF. */
export const SERIALS_INLINE_MAX = 24;
