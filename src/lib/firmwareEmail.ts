/**
 * E-mailteksten voor firmware-notificaties, in de Distrixs-huisstijl.
 *
 * Palet en opbouw volgen `src/components/pdf/PdfLayout.tsx`, zodat deze mails
 * eruitzien als de offertes en facturen die de klant al van ons krijgt: wit vlak
 * met het logo, oranje als accent, blauw voor de kop en een donkere merkbalk
 * onderaan.
 *
 *  1. Welkomstmail — bij het aanvinken, met de nieuwste bekende versie erin
 *  2. Notificatie  — de melding dat er nieuwe firmware is
 *  3. Interne mail — samenvatting voor onszelf
 */

export const CRM_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://crm.distrixs.nl";

// ─── Huisstijl (gelijk aan het PDF-palet) ─────────────────────────────────────

const C = {
  blue: "#0170B9",
  orange: "#ff6600",
  orangeSoft: "#ffb380",
  dark: "#2a2a2a",
  text: "#333333",
  muted: "#666666",
  light: "#999999",
  border: "#e0e0e0",
  tint: "#f5f5f5",
  white: "#ffffff",
};

const FONT = "Helvetica, Arial, 'Helvetica Neue', sans-serif";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Oranje knop als tabel: Outlook negeert padding op een gewone link. */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px 0;">
          <tr>
            <td style="background:${C.orange};border-radius:4px;">
              <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:bold;color:${C.white};text-decoration:none;">${label}</a>
            </td>
          </tr>
        </table>`;
}

/** Versieblok: lichte vulling met oranje kantlijn, zoals de totaalbalk in de PDF. */
function versionBlock(opts: {
  label: string;
  version: string;
  dateLabel: string | null;
  downloadUrl: string;
  buttonLabel: string;
}): string {
  return `              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
        <tr>
          <td style="background:${C.tint};border-left:4px solid ${C.orange};padding:20px 24px;">
            <p style="margin:0 0 6px 0;font-family:${FONT};font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;">${opts.label}</p>
            <p style="margin:0;font-family:${FONT};font-size:28px;font-weight:bold;color:${C.dark};line-height:1.1;">${esc(opts.version)}</p>
            ${
              opts.dateLabel
                ? `<p style="margin:6px 0 0 0;font-family:${FONT};font-size:13px;color:${C.muted};">Gepubliceerd op ${opts.dateLabel}</p>`
                : ""
            }
            ${button(opts.downloadUrl, opts.buttonLabel)}
          </td>
        </tr>
      </table>`;
}

/** Release notes van de fabrikant, met oranje streep als sectiemarkering. */
function notesBlock(notes: string, title: string): string {
  return `              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
        <tr>
          <td style="border:1px solid ${C.border};border-top:3px solid ${C.orange};padding:18px 22px;">
            <p style="margin:0 0 10px 0;font-family:${FONT};font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;">${title}</p>
            <div style="font-family:${FONT};font-size:14px;color:${C.text};line-height:1.65;">${notes
              .split("\n")
              .map((l) => esc(l))
              .join("<br>")}</div>
          </td>
        </tr>
      </table>`;
}

/**
 * Buitenkant van elke mail: logo op wit, oranje streep, inhoud, merkbalk.
 * Tabellen en inline stijlen — dat is wat mailprogramma's betrouwbaar aankunnen.
 */
function shell(opts: { title: string; inner: string; footerNote?: string }): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>${esc(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.tint};font-family:${FONT};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.tint};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${C.white};border:1px solid ${C.border};">

          <!-- Kop: logo op wit met oranje streep, net als onze documenten -->
          <tr>
            <td style="padding:26px 32px 20px 32px;">
              <img src="${CRM_BASE_URL}/logo.png" alt="Distrixs" width="150" style="display:block;width:150px;max-width:150px;height:auto;border:0;">
            </td>
          </tr>
          <tr><td style="height:3px;background:${C.orange};line-height:3px;font-size:0;">&nbsp;</td></tr>

          <!-- Inhoud -->
          <tr>
            <td style="padding:30px 32px 6px 32px;">
              <h1 style="margin:0 0 20px 0;font-family:${FONT};font-size:20px;font-weight:bold;color:${C.blue};line-height:1.3;">${esc(opts.title)}</h1>
${opts.inner}
            </td>
          </tr>

          <!-- Merkbalk onderaan, gelijk aan de documentfooter -->
          <tr>
            <td style="padding:20px 32px 30px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.dark};border-radius:4px;">
                <tr>
                  <td style="padding:14px 20px;">
                    <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:bold;color:${C.white};">Distrixs</p>
                    <p style="margin:4px 0 0 0;font-family:${FONT};font-size:12px;color:${C.orangeSoft};line-height:1.5;">
                      Lorentzstraat 89, 2665 JG Bleiswijk &nbsp;·&nbsp; +31 (0)10 223 01 87<br>
                      <a href="mailto:info@distrixs.nl" style="color:${C.orangeSoft};text-decoration:none;">info@distrixs.nl</a>
                      &nbsp;·&nbsp;
                      <a href="https://www.distrixs.nl" style="color:${C.orangeSoft};text-decoration:none;">www.distrixs.nl</a>
                    </p>
                  </td>
                </tr>
              </table>
              ${
                opts.footerNote
                  ? `<p style="margin:14px 0 0 0;font-family:${FONT};font-size:11px;color:${C.light};line-height:1.6;">${opts.footerNote}</p>`
                  : ""
              }
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function productLabel(name: string, model: string | null): string {
  return model && model !== name ? `${name} (${model})` : name;
}

function p(content: string, extra = ""): string {
  return `              <p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;color:${C.text};line-height:1.65;${extra}">${content}</p>`;
}

function dutchDate(d: Date | null | undefined): string | null {
  return d ? d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : null;
}

// ─── 1. Welkomstmail bij een nieuwe registratie ──────────────────────────────

/**
 * Gaat eenmalig uit zodra een product voor een klant wordt aangevinkt (of zodra
 * een zelfaanmelding wordt goedgekeurd). Bevat de nieuwste versie die op dat
 * moment bekend is, zodat de klant meteen iets aan de aanmelding heeft.
 */
export function buildRegisteredEmail(opts: {
  recipientName: string | null;
  productName: string;
  productModel: string | null;
  token: string;
  serialNumber?: string | null;
  latestVersion?: string | null;
  latestDownloadUrl?: string | null;
  latestReleaseDate?: Date | null;
  latestReleaseNotes?: string | null;
}): { subject: string; html: string } {
  const product = productLabel(opts.productName, opts.productModel);
  const unsubUrl = `${CRM_BASE_URL}/firmware-updates/afmelden?token=${opts.token}`;
  const hasRelease = Boolean(opts.latestVersion && opts.latestDownloadUrl);

  const inner = [
    p(`Beste ${esc(opts.recipientName) || "klant"},`),
    p(
      `De fabrikant van je <strong>${esc(product)}</strong>${
        opts.serialNumber ? ` (serienummer ${esc(opts.serialNumber)})` : ""
      } brengt regelmatig nieuwe firmware uit, maar kondigt dat nergens aan. Wij houden dat vanaf nu voor je bij: zodra er een nieuwe versie klaarstaat, krijg je automatisch bericht van ons.`
    ),
    hasRelease
      ? versionBlock({
          label: "Nieuwste versie op dit moment",
          version: opts.latestVersion!,
          dateLabel: dutchDate(opts.latestReleaseDate),
          downloadUrl: opts.latestDownloadUrl!,
          buttonLabel: "Deze versie downloaden",
        })
      : p(
          "Voor dit product staat op dit moment nog geen firmwarebestand bij de fabrikant. Zodra dat verandert, hoor je het van ons."
        ),
    opts.latestReleaseNotes
      ? notesBlock(opts.latestReleaseNotes, "Wat deze versie verandert (tekst van de fabrikant)")
      : "",
    hasRelease
      ? p(
          `Draait je armatuur al op deze versie? Dan hoef je niets te doen. Weet je het niet zeker, of loop je vast bij het installeren? Mail ons op <a href="mailto:info@distrixs.nl" style="color:${C.blue};">info@distrixs.nl</a> — we helpen je graag.`,
          `font-size:14px;color:${C.muted};`
        )
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: hasRelease
      ? `Firmware voor je ${esc(opts.productName)} — huidige versie ${esc(opts.latestVersion!)}`
      : `Wij houden de firmware van je ${esc(opts.productName)} in de gaten`,
    html: shell({
      title: hasRelease ? `Firmware-updates voor je ${esc(opts.productName)}` : "Wij houden je firmware in de gaten",
      inner,
      footerNote: `Je ontvangt deze mail omdat dit product bij ons voor je geregistreerd staat. <a href="${unsubUrl}" style="color:${C.light};">Geen updates meer ontvangen</a>`,
    }),
  };
}

// ─── 2. De firmware-melding zelf ──────────────────────────────────────────────

export function buildReleaseEmail(opts: {
  recipientName: string | null;
  productName: string;
  productModel: string | null;
  version: string;
  releaseDate: Date | null;
  releaseNotes: string | null;
  downloadUrl: string;
  token: string;
  serialNumber?: string | null;
}): { subject: string; html: string } {
  const product = productLabel(opts.productName, opts.productModel);
  const unsubUrl = `${CRM_BASE_URL}/firmware-updates/afmelden?token=${opts.token}`;

  const inner = [
    p(`Beste ${esc(opts.recipientName) || "klant"},`),
    p(
      `Er is nieuwe firmware beschikbaar voor je <strong>${esc(product)}</strong>${
        opts.serialNumber ? ` (serienummer ${esc(opts.serialNumber)})` : ""
      }.`
    ),
    versionBlock({
      label: "Nieuwe versie",
      version: opts.version,
      dateLabel: dutchDate(opts.releaseDate),
      downloadUrl: opts.downloadUrl,
      buttonLabel: "Firmware downloaden",
    }),
    // De fabrikant publiceert de release notes in het Engels; die nemen we
    // onbewerkt over — vertalen zou betekenisverschil kunnen introduceren.
    opts.releaseNotes ? notesBlock(opts.releaseNotes, "Wat is er veranderd (tekst van de fabrikant)") : "",
    p(
      `Twijfel je of deze update voor jouw uitvoering geschikt is, of loop je vast bij het installeren? Mail ons gerust op <a href="mailto:info@distrixs.nl" style="color:${C.blue};">info@distrixs.nl</a> — we helpen je er graag doorheen.`,
      `font-size:14px;color:${C.muted};`
    ),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Nieuwe firmware voor je ${esc(opts.productName)} — versie ${esc(opts.version)}`,
    html: shell({
      title: `Nieuwe firmware voor je ${esc(opts.productName)}`,
      inner,
      footerNote: `Je ontvangt deze mail omdat dit product bij ons voor je geregistreerd staat en wij firmware-updates van de fabrikant voor je in de gaten houden. <a href="${unsubUrl}" style="color:${C.light};">Geen updates meer ontvangen</a>`,
    }),
  };
}

// ─── 3. Alarm: de controle werkt niet meer ───────────────────────────────────

/**
 * Interne waarschuwing. Rood accent in plaats van oranje, want dit is geen
 * mededeling maar iets dat aandacht nodig heeft.
 */
export function buildFailureEmail(opts: {
  reason: string;
  detail?: string | null;
  lastOkAt?: Date | null;
}): { subject: string; html: string } {
  const red = "#c62828";
  const lastOk = opts.lastOkAt
    ? opts.lastOkAt.toLocaleString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "onbekend — er is nog geen geslaagde controle geregistreerd";

  const inner = [
    `              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
        <tr>
          <td style="background:#fdecea;border-left:4px solid ${red};padding:18px 22px;">
            <p style="margin:0;font-family:${FONT};font-size:16px;font-weight:bold;color:${red};">${esc(opts.reason)}</p>
            <p style="margin:8px 0 0 0;font-family:${FONT};font-size:14px;color:${C.text};line-height:1.6;">
              Zolang dit speelt, ziet het CRM geen nieuwe firmware — en krijgen aangemelde klanten dus ook
              geen bericht, zonder dat dat ergens opvalt.
            </p>
          </td>
        </tr>
      </table>`,
    p(`<strong>Laatste geslaagde controle:</strong> ${esc(lastOk)}`),
    opts.detail
      ? notesBlock(opts.detail, "Foutmelding")
      : "",
    p(
      "Wat te doen: kijk op het firmware-overzicht in het CRM naar de laatste controles, en probeer daar de knop " +
        "&bdquo;Nu controleren&rdquo;. Blijft het misgaan, dan heeft ACME waarschijnlijk de opbouw van de " +
        "supportpagina gewijzigd en moet de scraper worden aangepast.",
      `font-size:14px;color:${C.muted};`
    ),
    button(`${CRM_BASE_URL}/firmware`, "Naar het firmware-overzicht"),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Let op: firmware-controle werkt niet — ${opts.reason.toLowerCase()}`,
    html: shell({ title: "Firmware-controle vraagt aandacht", inner }),
  };
}

// ─── 4. Interne signalering ───────────────────────────────────────────────────

export function buildInternalAlertEmail(opts: {
  releases: Array<{ productName: string; productModel: string | null; version: string; recipients: number }>;
}): { subject: string; html: string } {
  const total = opts.releases.length;

  const th = (align: string) =>
    `padding:8px 0;border-bottom:2px solid ${C.orange};font-family:${FONT};font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;text-align:${align};`;

  const rows = opts.releases
    .map(
      (r) => `<tr>
            <td style="padding:10px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.text};font-weight:bold;">${esc(
              productLabel(r.productName, r.productModel)
            )}</td>
            <td style="padding:10px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.text};">${esc(r.version)}</td>
            <td style="padding:10px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.muted};text-align:right;">${r.recipients} ${
              r.recipients === 1 ? "klant" : "klanten"
            }</td>
          </tr>`
    )
    .join("\n");

  const inner = [
    p(
      `De firmware-monitor vond ${total} nieuwe release${total === 1 ? "" : "s"}. Aangemelde klanten hebben automatisch bericht gekregen.`
    ),
    `              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
          <tr>
            <td style="${th("left")}">Product</td>
            <td style="${th("left")}">Versie</td>
            <td style="${th("right")}">Verstuurd</td>
          </tr>
${rows}
        </table>`,
    button(`${CRM_BASE_URL}/firmware`, "Naar het firmware-overzicht"),
  ].join("\n");

  return {
    subject: `${total} nieuwe firmware-release${total === 1 ? "" : "s"} bij ACME`,
    html: shell({ title: "Nieuwe firmware bij ACME", inner }),
  };
}
