/**
 * ACME Lighting firmware-scraper.
 *
 * De leverancier publiceert firmware op https://en.acmelighting.com/support?id=172.
 * Er is geen API en geen RSS/notificatie — de pagina is wel server-side gerenderde
 * HTML met een vaste tabelstructuur, dus die parsen we.
 *
 * Structuur van één rij:
 *   <td class="col-lg-3">ZEUS (XP 500 BSW IP)-V17-svn92764</td>   ← bestandstitel
 *   <td class="col-lg-3">V17</td>                                  ← versie
 *   <td class="col-lg-3"><a class="upgrade-log-btn" data-content="…">  ← release notes (HTML)
 *   <td class="col-lg-3">2026-08-14</td>                           ← datum
 *   <td class="col-lg-3"><a href="javascript:download('/upload/…zip','…')">  ← download
 *
 * De .zip-bestanden zijn publiek en direct opvraagbaar (geen login/referer nodig).
 */

export const ACME_BASE_URL = "https://en.acmelighting.com";
export const ACME_FIRMWARE_PATH = "/support?id=172";

export interface ParsedRelease {
  /** Volledige bestandstitel, bv. "ZEUS (XP 500 BSW IP)-V17-svn92764" */
  fileTitle: string;
  /** Productnaam, bv. "ZEUS" */
  productName: string;
  /** Modelaanduiding tussen haakjes, bv. "XP 500 BSW IP" */
  productModel: string | null;
  /** Versie zoals ACME hem noemt, bv. "V17" */
  version: string;
  /** Buildcode achter de versie, bv. "svn92764" */
  build: string | null;
  /** Publicatiedatum (ISO yyyy-mm-dd) of null als de kolom leeg was */
  releaseDate: string | null;
  /** Absolute download-URL */
  downloadUrl: string;
  /** Release notes als platte tekst (regels), of null */
  releaseNotes: string | null;
}

// ─── HTML-helpers ─────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#34": '"',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#34);/g, (_, e: string) => ENTITIES[e] ?? _)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

/** Strip HTML-tags en normaliseer whitespace. `<li>`/`<br>` worden regeleindes. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(li|p|div|ol|ul|tr)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Haalt de titel uiteen: "ZEUS (XP 500 BSW IP)-V17-svn92764"
 *   → name "ZEUS", model "XP 500 BSW IP", version "V17", build "svn92764"
 *
 * Niet elke titel volgt dat patroon (oude regels zijn bv. "XP-5R BEAM II-V10-20141225"),
 * dus we vallen stap voor stap terug op wat er wél in staat.
 */
export function parseFileTitle(
  rawTitle: string,
  versionCell: string | null
): { productName: string; productModel: string | null; version: string; build: string | null } {
  const title = rawTitle.replace(/\s+/g, " ").trim();

  let productName = title;
  let productModel: string | null = null;

  // Model tussen haakjes, bv. "ZEUS (XP 500 BSW IP)-V17-…"
  const paren = title.match(/^(.*?)\s*\(([^)]*)\)\s*(.*)$/);
  let rest = "";
  if (paren) {
    productName = paren[1].trim();
    productModel = paren[2].trim() || null;
    rest = paren[3];
  }

  // Versie: uit de aparte kolom als die er is, anders uit de titel.
  let version = (versionCell ?? "").trim();
  let build: string | null = null;

  const source = paren ? rest : title;
  // Zoekt "-V17-svn92764", "-V10-20141225" of alleen "-V17"
  const vMatch = source.match(/-\s*(V\s?[\d.]+[A-Za-z]?)\s*(?:-\s*(.+?))?\s*$/i);
  if (vMatch) {
    if (!version) version = vMatch[1].replace(/\s+/g, "").toUpperCase();
    build = vMatch[2]?.trim() || null;
    if (!paren) {
      // Geen haakjes: alles vóór de versie is de productnaam.
      productName = source.slice(0, vMatch.index).replace(/[-\s]+$/, "").trim();
    }
  } else if (!paren) {
    productName = title;
  }

  if (!version) version = "onbekend";
  if (!productName) productName = title;

  return { productName, productModel, version, build };
}

/** Genormaliseerde sleutel waarop we versies van hetzelfde product groeperen. */
export function firmwareSlug(productName: string, productModel: string | null): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const name = norm(productName);
  const model = productModel ? norm(productModel) : "";
  return model && model !== name ? `${name}--${model}` : name;
}

/** Splitst de tabel in `<tr>`-blokken en die weer in `<td>`-cellen. */
function extractRows(html: string): string[][] {
  // Alleen de body van de firmware-tabel, niet eventuele andere tabellen op de pagina.
  const bodyMatch = html.match(/<tbody[^>]*id=["']sub-tab-content["'][^>]*>([\s\S]*?)<\/tbody>/i);
  const body = bodyMatch ? bodyMatch[1] : html;

  const rows: string[][] = [];
  for (const tr of body.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    // HTML-commentaar bevat een dummy-cel; die moet weg vóór we cellen tellen.
    const clean = tr.replace(/<!--[\s\S]*?-->/g, "");
    const cells = (clean.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map((td) =>
      td.replace(/^<td[^>]*>/i, "").replace(/<\/td>$/i, "")
    );
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function findDownloadUrl(cells: string[]): string | null {
  for (const cell of cells) {
    // Vorm: href="javascript:download('/upload/…zip','titel')"
    const js = cell.match(/download\(\s*['"]([^'"]+)['"]/i);
    if (js) return js[1];
    const href = cell.match(/href=["'](\/upload\/[^"']+)["']/i);
    if (href) return href[1];
  }
  return null;
}

function findReleaseNotes(cells: string[]): string | null {
  for (const cell of cells) {
    const m = cell.match(/data-content=["']([\s\S]*?)["']\s*(?:style|class|href|>)/i);
    if (m) {
      const text = htmlToText(decodeEntities(m[1]));
      if (text) return text;
    }
  }
  return null;
}

function findDate(cells: string[]): string | null {
  for (const cell of cells) {
    const text = htmlToText(cell);
    const m = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (m) {
      const [, y, mo, d] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return null;
}

/** Parseert één overzichtspagina naar releases. */
export function parseFirmwarePage(html: string): ParsedRelease[] {
  const out: ParsedRelease[] = [];

  for (const cells of extractRows(html)) {
    const downloadPath = findDownloadUrl(cells);
    if (!downloadPath) continue; // rij zonder download = geen bruikbare release

    const fileTitle = htmlToText(cells[0] ?? "");
    if (!fileTitle) continue;

    const versionCell = cells[1] ? htmlToText(cells[1]) : null;
    const { productName, productModel, version, build } = parseFileTitle(
      fileTitle,
      versionCell && /^v/i.test(versionCell) ? versionCell : null
    );

    out.push({
      fileTitle,
      productName,
      productModel,
      version,
      build,
      releaseDate: findDate(cells.slice(2)),
      downloadUrl: downloadPath.startsWith("http") ? downloadPath : ACME_BASE_URL + downloadPath,
      releaseNotes: findReleaseNotes(cells),
    });
  }

  return out;
}

/** Leest het hoogste paginanummer uit de paginering (voor een volledige backfill). */
export function parseLastPage(html: string): number {
  let max = 1;
  for (const m of html.matchAll(/[?&](?:amp;)?page=(\d+)/gi)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

// ─── Ophalen ──────────────────────────────────────────────────────────────────

async function fetchPage(page: number, signal?: AbortSignal): Promise<string> {
  const url = page <= 1 ? `${ACME_BASE_URL}${ACME_FIRMWARE_PATH}` : `${ACME_BASE_URL}${ACME_FIRMWARE_PATH}&page=${page}`;
  const res = await fetch(url, {
    headers: {
      // Nette identificatie richting de leverancier — geen verhulde scraper.
      "User-Agent": "Distrixs-CRM firmware-monitor (+https://www.distrixs.nl)",
      Accept: "text/html",
    },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`ACME pagina ${page}: HTTP ${res.status}`);
  return res.text();
}

export interface ScrapeResult {
  releases: ParsedRelease[];
  pagesFetched: number;
  lastPageAvailable: number;
}

/**
 * Haalt `maxPages` pagina's op (nieuwste eerst). `maxPages = 0` betekent: alles.
 * Er zit een korte pauze tussen requests zodat we de leverancier niet belasten.
 */
export async function scrapeFirmware(maxPages = 3, signal?: AbortSignal): Promise<ScrapeResult> {
  const first = await fetchPage(1, signal);
  const lastPageAvailable = parseLastPage(first);
  const limit = maxPages > 0 ? Math.min(maxPages, lastPageAvailable) : lastPageAvailable;

  const releases = parseFirmwarePage(first);
  const seen = new Set(releases.map((r) => r.downloadUrl));

  for (let page = 2; page <= limit; page++) {
    await new Promise((r) => setTimeout(r, 400));
    const html = await fetchPage(page, signal);
    for (const rel of parseFirmwarePage(html)) {
      if (seen.has(rel.downloadUrl)) continue;
      seen.add(rel.downloadUrl);
      releases.push(rel);
    }
  }

  return { releases, pagesFetched: limit, lastPageAvailable };
}
