/**
 * E-mailteksten voor firmware-notificaties.
 *
 * Wie een registratie krijgt, wordt in het CRM aangevinkt; de klant hoeft daar
 * niets voor te doen. Meldt een klant zich zélf aan via de publieke pagina, dan
 * krijgt hij na goedkeuring de bevestigingsmail.
 *
 *  1. Welkomstmail — bij het aanvinken, met de nieuwste bekende versie erin
 *  2. Notificatie  — de melding dat er nieuwe firmware is
 *  3. Interne mail — samenvatting voor onszelf
 */

export const CRM_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://crm.distrixs.nl";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#1e40af;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Distrixs</h1>
    </div>
    <div style="padding:32px;">
${inner}
    </div>
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        Distrixs · Lorentzstraat 89, 2665 JG Bleiswijk · <a href="https://www.distrixs.nl" style="color:#94a3b8;">www.distrixs.nl</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function productLabel(name: string, model: string | null): string {
  return model && model !== name ? `${name} (${model})` : name;
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
  const dateLabel = opts.latestReleaseDate
    ? opts.latestReleaseDate.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const notesHtml = opts.latestReleaseNotes
    ? `<div style="background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
        <p style="margin:0 0 10px 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Wat deze versie verandert (tekst van de fabrikant)</p>
        <div style="margin:0;color:#334155;font-size:14px;line-height:1.6;">${opts.latestReleaseNotes
          .split("\n")
          .map((l) => esc(l))
          .join("<br>")}</div>
      </div>`
    : "";

  return {
    subject: hasRelease
      ? `Firmware voor je ${esc(opts.productName)} — huidige versie ${esc(opts.latestVersion!)}`
      : `Wij houden de firmware van je ${esc(opts.productName)} in de gaten`,
    html: shell(`
      <p style="margin:0 0 20px 0;color:#374151;">Beste ${esc(opts.recipientName) || "klant"},</p>
      <p style="margin:0 0 16px 0;color:#374151;">
        De fabrikant van je <strong>${esc(product)}</strong>${
          opts.serialNumber ? ` (serienummer ${esc(opts.serialNumber)})` : ""
        }
        brengt regelmatig nieuwe firmware uit, maar kondigt dat nergens aan. Wij houden dat
        vanaf nu voor je bij: zodra er een nieuwe versie klaarstaat, krijg je automatisch
        bericht van ons.
      </p>
      ${
        hasRelease
          ? `<div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Nieuwste versie op dit moment</p>
        <p style="margin:0 0 4px 0;font-size:26px;font-weight:700;color:#1e293b;">${esc(opts.latestVersion!)}</p>
        ${dateLabel ? `<p style="margin:0 0 14px 0;font-size:13px;color:#64748b;">Gepubliceerd op ${dateLabel}</p>` : ""}
        <a href="${opts.latestDownloadUrl}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">Deze versie downloaden</a>
      </div>
      ${notesHtml}
      <p style="margin:0 0 16px 0;font-size:13px;color:#64748b;line-height:1.6;">
        Draait je armatuur al op deze versie? Dan hoef je niets te doen. Weet je het niet zeker,
        of loop je vast bij het installeren? Mail ons op
        <a href="mailto:info@distrixs.nl" style="color:#1e40af;">info@distrixs.nl</a> — we helpen je graag.
      </p>`
          : `<p style="margin:0 0 16px 0;color:#374151;">
        Voor dit product staat op dit moment nog geen firmwarebestand bij de fabrikant. Zodra dat
        verandert, hoor je het van ons.
      </p>`
      }
      <p style="margin:24px 0 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
        Je ontvangt deze mail omdat dit product bij ons voor je geregistreerd staat.
        <a href="${unsubUrl}" style="color:#94a3b8;">Geen updates meer ontvangen</a>
      </p>
    `),
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
  const dateLabel = opts.releaseDate
    ? opts.releaseDate.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // De fabrikant publiceert de release notes in het Engels; die nemen we
  // onbewerkt over — vertalen zou betekenisverschil kunnen introduceren.
  const notesHtml = opts.releaseNotes
    ? `<div style="background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
        <p style="margin:0 0 10px 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Wat is er veranderd (tekst van de fabrikant)</p>
        <div style="margin:0;color:#334155;font-size:14px;line-height:1.6;">${opts.releaseNotes
          .split("\n")
          .map((l) => esc(l))
          .join("<br>")}</div>
      </div>`
    : "";

  return {
    subject: `Nieuwe firmware voor je ${esc(opts.productName)} — versie ${esc(opts.version)}`,
    html: shell(`
      <p style="margin:0 0 20px 0;color:#374151;">Beste ${esc(opts.recipientName) || "klant"},</p>
      <p style="margin:0 0 16px 0;color:#374151;">
        Er is nieuwe firmware beschikbaar voor de <strong>${esc(product)}</strong>${
          opts.serialNumber ? ` (serienummer ${esc(opts.serialNumber)})` : ""
        }.
      </p>

      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Nieuwe versie</p>
        <p style="margin:0;font-size:26px;font-weight:700;color:#1e293b;">${esc(opts.version)}</p>
        ${dateLabel ? `<p style="margin:6px 0 0 0;font-size:13px;color:#64748b;">Gepubliceerd op ${dateLabel}</p>` : ""}
      </div>

      ${notesHtml}

      <p style="margin:24px 0;">
        <a href="${opts.downloadUrl}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          Firmware downloaden
        </a>
      </p>

      <p style="margin:0 0 16px 0;font-size:13px;color:#64748b;line-height:1.6;">
        Twijfel je of deze update voor jouw uitvoering geschikt is, of loop je vast bij het
        installeren? Mail ons gerust op
        <a href="mailto:info@distrixs.nl" style="color:#1e40af;">info@distrixs.nl</a> —
        we helpen je er graag doorheen.
      </p>

      <p style="margin:24px 0 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
        Je ontvangt deze mail omdat dit product bij ons voor je geregistreerd staat en wij
        firmware-updates van de fabrikant voor je in de gaten houden.
        <a href="${unsubUrl}" style="color:#94a3b8;">Geen updates meer ontvangen</a>
      </p>
    `),
  };
}

// ─── 3. Interne signalering ───────────────────────────────────────────────────

export function buildInternalAlertEmail(opts: {
  releases: Array<{ productName: string; productModel: string | null; version: string; recipients: number }>;
}): { subject: string; html: string } {
  const total = opts.releases.length;
  const rows = opts.releases
    .map(
      (r) => `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#1e293b;font-weight:500;">${esc(productLabel(r.productName, r.productModel))}</td>
        <td style="padding:10px 0;color:#1e293b;">${esc(r.version)}</td>
        <td style="padding:10px 0;color:#64748b;text-align:right;">${r.recipients} ${r.recipients === 1 ? "klant" : "klanten"}</td>
      </tr>`
    )
    .join("");

  return {
    subject: `${total} nieuwe firmware-release${total === 1 ? "" : "s"} bij ACME`,
    html: shell(`
      <p style="margin:0 0 16px 0;color:#374151;">
        De firmware-monitor vond ${total} nieuwe release${total === 1 ? "" : "s"}.
        Aangemelde klanten hebben automatisch bericht gekregen.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <tr style="border-bottom:2px solid #e2e8f0;">
          <th style="padding:8px 0;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Product</th>
          <th style="padding:8px 0;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Versie</th>
          <th style="padding:8px 0;text-align:right;font-size:12px;color:#64748b;text-transform:uppercase;">Verstuurd</th>
        </tr>
        ${rows}
      </table>
      <p style="margin:20px 0 0 0;">
        <a href="${CRM_BASE_URL}/firmware" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">Naar het firmware-overzicht</a>
      </p>
    `),
  };
}
