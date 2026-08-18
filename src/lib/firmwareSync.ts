/**
 * Synchronisatie van de ACME-firmwarepagina naar het CRM, plus het versturen
 * van de klantnotificaties.
 *
 * Verloop van een sync:
 *   1. scrape de eerste N pagina's (nieuwste eerst)
 *   2. upsert firmwareproducten en -releases
 *   3. voor elke écht nieuwe release: mail alle ACTIVE registraties
 *
 * Twee beveiligingen tegen een ongewenste mailstorm:
 *   • de eerste sync draait als *baseline*: alles wat er dan al staat wordt
 *     gemarkeerd als "gezien" en levert nooit een mail op;
 *   • een release ouder dan MAX_NOTIFY_AGE_DAYS wordt nooit gemaild, ook niet
 *     als de leverancier hem opnieuw publiceert of van URL verandert.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { scrapeFirmware, firmwareSlug, type ParsedRelease } from "@/lib/acmeFirmware";
import {
  buildReleaseEmail,
  buildRegisteredEmail,
  buildInternalAlertEmail,
  buildFailureEmail,
} from "@/lib/firmwareEmail";
import { randomBytes } from "crypto";

/** Releases ouder dan dit aantal dagen leveren nooit een klantmail op. */
const MAX_NOTIFY_AGE_DAYS = 90;

export function newRegistrationToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface SyncOptions {
  /** Aantal pagina's; 0 = alles (±102 pagina's, alleen voor de eerste vulling). */
  maxPages?: number;
  /** true = alleen inlezen, niets mailen. Wordt automatisch aangezet bij een lege database. */
  baseline?: boolean;
  /** cron | handmatig | backfill */
  trigger?: string;
  /** true = wel bepalen wie mail zou krijgen, maar niet versturen. */
  dryRun?: boolean;
}

export interface SyncSummary {
  runId: string;
  pagesFetched: number;
  releasesSeen: number;
  newReleases: number;
  notificationsSent: number;
  baseline: boolean;
  ok: boolean;
  error?: string;
  details: Array<{ releaseId: string; product: string; version: string; recipients: number }>;
}

// ─── Opslaan van wat de scraper vond ─────────────────────────────────────────

async function upsertRelease(parsed: ParsedRelease, baseline: boolean) {
  const slug = firmwareSlug(parsed.productName, parsed.productModel);

  const product = await prisma.firmwareProduct.upsert({
    where: { slug },
    create: {
      slug,
      name: parsed.productName,
      model: parsed.productModel,
    },
    update: {
      // Naam/model kunnen bij de leverancier iets wijzigen; laatste stand wint.
      name: parsed.productName,
      model: parsed.productModel,
    },
  });

  const existing = await prisma.firmwareRelease.findUnique({
    where: { downloadUrl: parsed.downloadUrl },
    select: { id: true },
  });

  if (existing) {
    // Bestaande regel: alleen bijwerken wat de leverancier kan aanpassen.
    await prisma.firmwareRelease.update({
      where: { id: existing.id },
      data: {
        version: parsed.version,
        fileTitle: parsed.fileTitle,
        build: parsed.build,
        releaseDate: parsed.releaseDate ? new Date(parsed.releaseDate) : null,
        releaseNotes: parsed.releaseNotes,
      },
    });
    return { isNew: false, releaseId: existing.id, productId: product.id };
  }

  const created = await prisma.firmwareRelease.create({
    data: {
      firmwareProductId: product.id,
      version: parsed.version,
      fileTitle: parsed.fileTitle,
      build: parsed.build,
      releaseDate: parsed.releaseDate ? new Date(parsed.releaseDate) : null,
      downloadUrl: parsed.downloadUrl,
      releaseNotes: parsed.releaseNotes,
      isBaseline: baseline,
      // Bij een baseline meteen als "afgehandeld" wegzetten: geen mail achteraf.
      notifiedAt: baseline ? new Date() : null,
    },
    select: { id: true },
  });

  return { isNew: true, releaseId: created.id, productId: product.id };
}

// ─── Notificaties ─────────────────────────────────────────────────────────────

/**
 * Mailt één release naar alle actieve registraties die hem nog niet hadden.
 * Retourneert het aantal verstuurde mails.
 */
export async function notifyRelease(releaseId: string, dryRun = false): Promise<number> {
  const release = await prisma.firmwareRelease.findUnique({
    where: { id: releaseId },
    include: { firmwareProduct: true },
  });
  if (!release) return 0;

  // Te oude releases nooit mailen — voorkomt een storm bij een hersteloperatie.
  if (release.releaseDate) {
    const ageDays = (Date.now() - release.releaseDate.getTime()) / 86_400_000;
    if (ageDays > MAX_NOTIFY_AGE_DAYS) {
      await prisma.firmwareRelease.update({
        where: { id: releaseId },
        data: { notifiedAt: new Date() },
      });
      return 0;
    }
  }

  const registrations = await prisma.firmwareRegistration.findMany({
    where: {
      firmwareProductId: release.firmwareProductId,
      status: "ACTIVE",
      // Al eerder gemaild over precies deze release? Dan overslaan.
      notifications: { none: { releaseId } },
    },
    include: { contact: true },
  });

  let sent = 0;
  for (const reg of registrations) {
    const email = reg.email?.trim();
    if (!email) continue;

    const name = reg.name ?? (reg.contact ? `${reg.contact.firstName} ${reg.contact.lastName}`.trim() : null);
    const { subject, html } = buildReleaseEmail({
      recipientName: name,
      productName: release.firmwareProduct.name,
      productModel: release.firmwareProduct.model,
      version: release.version,
      releaseDate: release.releaseDate,
      releaseNotes: release.releaseNotes,
      downloadUrl: release.downloadUrl,
      token: reg.token,
      serialNumber: reg.serialNumber,
    });

    if (dryRun) {
      sent++;
      continue;
    }

    const result = await sendEmail({ to: email, subject, html });

    await prisma.firmwareNotification.create({
      data: {
        releaseId,
        registrationId: reg.id,
        email,
        status: result.ok ? "SENT" : "FAILED",
        error: result.ok ? null : (result.error ?? "onbekende fout"),
      },
    });

    if (result.ok) {
      sent++;
      await prisma.firmwareRegistration.update({
        where: { id: reg.id },
        data: { lastNotifiedAt: new Date() },
      });
    }
  }

  if (!dryRun) {
    await prisma.firmwareRelease.update({
      where: { id: releaseId },
      data: { notifiedAt: new Date() },
    });
  }

  return sent;
}

/**
 * Stuurt eenmalig de nieuwste bekende firmware naar een net aangevinkte registratie.
 *
 * Gebeurt zodra een product voor een klant wordt aangezet: dan heeft hij meteen
 * iets aan de aanmelding in plaats van pas bij de volgende release. De verzending
 * wordt als notificatie gelogd, zodat de dagelijkse sync diezelfde versie later
 * niet nóg een keer mailt.
 *
 * De leeftijdsgrens van MAX_NOTIFY_AGE_DAYS geldt hier bewust NIET: dit is geen
 * "er is nieuwe firmware"-melding maar een "dit is de versie die nu klaarstaat".
 */
export async function sendCurrentFirmware(registrationId: string): Promise<boolean> {
  const reg = await prisma.firmwareRegistration.findUnique({
    where: { id: registrationId },
    include: { firmwareProduct: true, contact: true },
  });
  if (!reg || reg.status !== "ACTIVE") return false;

  const email = reg.email?.trim();
  if (!email) return false;

  const latest = await prisma.firmwareRelease.findFirst({
    where: { firmwareProductId: reg.firmwareProductId },
    orderBy: [{ releaseDate: "desc" }, { firstSeenAt: "desc" }],
  });

  // Al eerder over deze release gemaild? Dan niets doen — voorkomt dubbele post
  // als een registratie wordt uit- en weer aangezet.
  if (latest) {
    const already = await prisma.firmwareNotification.findUnique({
      where: { releaseId_registrationId: { releaseId: latest.id, registrationId: reg.id } },
      select: { id: true },
    });
    if (already) return false;
  }

  const name = reg.name ?? (reg.contact ? `${reg.contact.firstName} ${reg.contact.lastName}`.trim() : null);
  const { subject, html } = buildRegisteredEmail({
    recipientName: name,
    productName: reg.firmwareProduct.name,
    productModel: reg.firmwareProduct.model,
    token: reg.token,
    serialNumber: reg.serialNumber,
    latestVersion: latest?.version ?? null,
    latestDownloadUrl: latest?.downloadUrl ?? null,
    latestReleaseDate: latest?.releaseDate ?? null,
    latestReleaseNotes: latest?.releaseNotes ?? null,
  });

  const result = await sendEmail({ to: email, subject, html });

  if (latest) {
    await prisma.firmwareNotification.create({
      data: {
        releaseId: latest.id,
        registrationId: reg.id,
        email,
        status: result.ok ? "SENT" : "FAILED",
        error: result.ok ? null : (result.error ?? "onbekende fout"),
      },
    });
  }

  if (result.ok) {
    await prisma.firmwareRegistration.update({
      where: { id: reg.id },
      data: { lastNotifiedAt: new Date() },
    });
  }

  return result.ok;
}

// ─── De sync zelf ─────────────────────────────────────────────────────────────

export async function syncFirmware(opts: SyncOptions = {}): Promise<SyncSummary> {
  const trigger = opts.trigger ?? "handmatig";
  const dryRun = opts.dryRun ?? false;

  // Lege database ⇒ altijd baseline, wat de aanroeper ook meegeeft. Anders zou een
  // eerste sync ruim duizend "nieuwe" releases als klantmail de deur uit sturen.
  const knownReleases = await prisma.firmwareRelease.count();
  const baseline = knownReleases === 0 ? true : (opts.baseline ?? false);
  const maxPages = opts.maxPages ?? (baseline ? 0 : 3);

  const run = await prisma.firmwareSyncRun.create({
    data: { trigger: baseline ? "backfill" : trigger },
    select: { id: true },
  });

  const summary: SyncSummary = {
    runId: run.id,
    pagesFetched: 0,
    releasesSeen: 0,
    newReleases: 0,
    notificationsSent: 0,
    baseline,
    ok: true,
    details: [],
  };

  try {
    const { releases, pagesFetched } = await scrapeFirmware(maxPages);
    summary.pagesFetched = pagesFetched;
    summary.releasesSeen = releases.length;

    const newReleaseIds: string[] = [];
    // Oudste eerst wegschrijven, zodat notificaties in chronologische volgorde gaan.
    for (const parsed of [...releases].reverse()) {
      const { isNew, releaseId } = await upsertRelease(parsed, baseline);
      if (isNew && !baseline) newReleaseIds.push(releaseId);
      if (isNew) summary.newReleases++;
    }

    for (const releaseId of newReleaseIds) {
      const count = await notifyRelease(releaseId, dryRun);
      summary.notificationsSent += count;

      const rel = await prisma.firmwareRelease.findUnique({
        where: { id: releaseId },
        include: { firmwareProduct: true },
      });
      if (rel) {
        summary.details.push({
          releaseId,
          product: rel.firmwareProduct.model
            ? `${rel.firmwareProduct.name} (${rel.firmwareProduct.model})`
            : rel.firmwareProduct.name,
          version: rel.version,
          recipients: count,
        });
      }
    }

    // Interne samenvatting — alleen als er echt iets nieuws was.
    const alertTo = process.env.FIRMWARE_ALERT_EMAIL;
    if (alertTo && newReleaseIds.length > 0 && !dryRun) {
      const releaseRows = await prisma.firmwareRelease.findMany({
        where: { id: { in: newReleaseIds } },
        include: { firmwareProduct: true },
      });
      const { subject, html } = buildInternalAlertEmail({
        releases: releaseRows.map((r) => ({
          productName: r.firmwareProduct.name,
          productModel: r.firmwareProduct.model,
          version: r.version,
          recipients: summary.details.find((d) => d.releaseId === r.id)?.recipients ?? 0,
        })),
      });
      await sendEmail({ to: alertTo.split(",").map((s) => s.trim()), subject, html });
    }
  } catch (err) {
    summary.ok = false;
    summary.error = err instanceof Error ? err.message : String(err);

    // Meteen melden: een stille scraper is het gevaarlijkste scenario, want dan
    // denken we dat er geen nieuwe firmware is terwijl we simpelweg niets zien.
    const alertTo = process.env.FIRMWARE_ALERT_EMAIL;
    if (alertTo) {
      const { subject, html } = buildFailureEmail({
        reason: "De firmware-controle is vastgelopen",
        detail: summary.error,
        lastOkAt: (
          await prisma.firmwareSyncRun.findFirst({
            where: { ok: true, finishedAt: { not: null } },
            orderBy: { startedAt: "desc" },
            select: { startedAt: true },
          })
        )?.startedAt ?? null,
      });
      // Faalt ook de mail, dan mag dat de sync niet verder ontregelen.
      await sendEmail({ to: alertTo.split(",").map((s) => s.trim()), subject, html }).catch(() => undefined);
    }
  }

  await prisma.firmwareSyncRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      pagesFetched: summary.pagesFetched,
      releasesSeen: summary.releasesSeen,
      newReleases: summary.newReleases,
      notificationsSent: summary.notificationsSent,
      ok: summary.ok,
      error: summary.error ?? null,
    },
  });

  return summary;
}

// ─── Bewaking ─────────────────────────────────────────────────────────────────

export interface WatchdogResult {
  healthy: boolean;
  /** Uren sinds de laatste geslaagde controle; null als er nog nooit één was. */
  hoursSinceLastOk: number | null;
  lastOkAt: string | null;
  lastRunAt: string | null;
  lastRunOk: boolean | null;
  lastError: string | null;
  alerted: boolean;
  reason?: string;
}

/**
 * Kijkt of de dagelijkse controle nog gezond is en mailt als dat niet zo is.
 *
 * Dit vangt drie dingen: een vastgelopen scraper, een controle die om een andere
 * reden nooit klaarkomt, en een cron die helemaal niet meer draait — dat laatste
 * blijkt uit de leeftijd van de laatste geslaagde run.
 *
 * Wat het NIET kan vangen: een server die volledig plat ligt, want dan draait
 * deze bewaking zelf ook niet. Zodra de server terug is, meldt hij het alsnog.
 */
export async function runWatchdog(maxAgeHours = 30): Promise<WatchdogResult> {
  const [lastOk, lastRun] = await Promise.all([
    prisma.firmwareSyncRun.findFirst({
      where: { ok: true, finishedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
    prisma.firmwareSyncRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, ok: true, error: true, finishedAt: true },
    }),
  ]);

  const hoursSinceLastOk = lastOk ? (Date.now() - lastOk.startedAt.getTime()) / 3_600_000 : null;

  // Onder de twee uur in minuten schrijven; anders leest een testmelding als
  // "0 uur oud", en die tekst staat ook in de mailtitel.
  const ageLabel = (hours: number): string =>
    hours < 2 ? `${Math.max(1, Math.round(hours * 60))} minuten` : `${Math.round(hours)} uur`;

  let reason: string | undefined;
  if (!lastOk) {
    reason = "Er is nog nooit een geslaagde firmware-controle geweest";
  } else if (hoursSinceLastOk !== null && hoursSinceLastOk > maxAgeHours) {
    reason = `De laatste geslaagde firmware-controle is ${ageLabel(hoursSinceLastOk)} oud`;
  } else if (lastRun && !lastRun.ok) {
    reason = "De laatste firmware-controle is mislukt";
  } else if (lastRun && !lastRun.finishedAt) {
    reason = "De laatste firmware-controle is nooit afgerond";
  }

  const result: WatchdogResult = {
    healthy: !reason,
    hoursSinceLastOk: hoursSinceLastOk === null ? null : Math.round(hoursSinceLastOk * 10) / 10,
    lastOkAt: lastOk?.startedAt.toISOString() ?? null,
    lastRunAt: lastRun?.startedAt.toISOString() ?? null,
    lastRunOk: lastRun?.ok ?? null,
    lastError: lastRun?.error ?? null,
    alerted: false,
    reason,
  };

  const alertTo = process.env.FIRMWARE_ALERT_EMAIL;
  if (reason && alertTo) {
    const { subject, html } = buildFailureEmail({
      reason,
      detail: lastRun?.error ?? null,
      lastOkAt: lastOk?.startedAt ?? null,
    });
    const sent = await sendEmail({ to: alertTo.split(",").map((s) => s.trim()), subject, html }).catch(() => ({
      ok: false,
    }));
    result.alerted = Boolean(sent?.ok);
  }

  return result;
}

// ─── Koppeling CRM-artikel ↔ firmwareproduct ─────────────────────────────────

/** Normaliseert een artikelnaam voor vergelijking (hoofdletters, leestekens, ruis). */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bacme\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Herkent reserveonderdelen en toebehoren. Die horen geen firmwarekoppeling te
 * krijgen: wie een O-ring of een montagebeugel koopt, heeft geen armatuur waarvoor
 * firmware uitkomt.
 *
 * Twee signalen uit de praktijk van het assortiment:
 *  - onderdeelnummers beginnen met "P-" (P-TB 5 IP-BL, P-Tornado-504507…)
 *  - de titel bevat een onderdeelwoord (cover, gasket, sync belt, sensor board …)
 *
 * Tekst tussen haakjes telt niet mee: "Blinder Set (2x controller, 8x2 cable)" is
 * een armatuurset, geen kabel. En "washer" staat er bewust NIET in — dat zou
 * "LED WASHER 18X10W" ten onrechte uitsluiten.
 */
const SPARE_PART_WORDS =
  /\b(cover|o[- ]?ring|screw|bolt|gasket|bracket|belt|pcb|yoke|silica|sealing|fixation|bearing|sensor board|side plate|extension cable|adapter cable|spare|onderdeel|reserve)\b/i;

function isSparePart(sku: string, title: string): boolean {
  if (/^p-/i.test(sku.trim())) return true;
  return SPARE_PART_WORDS.test(title.replace(/\([^)]*\)/g, " "));
}

/**
 * Zoekt bij elk CRM-artikel het waarschijnlijke ACME-firmwareproduct.
 * Levert alleen voorstellen op — bevestigen gebeurt in het CRM.
 */
export async function suggestProductLinks(): Promise<number> {
  const [products, firmwareProducts, existing] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, sku: true, title: true } }),
    prisma.firmwareProduct.findMany({ select: { id: true, name: true, model: true } }),
    prisma.productFirmwareLink.findMany({ select: { productId: true, firmwareProductId: true } }),
  ]);

  const alreadyLinked = new Set(existing.map((l) => `${l.productId}:${l.firmwareProductId}`));
  const linkedProducts = new Set(existing.map((l) => l.productId));

  // Sleutels die alleen uit cijfers bestaan zijn onbruikbaar: "1000" komt terug in
  // "Extension 1000cm" en zelfs midden in artikelnummers, en koppelde in de praktijk
  // tientallen willekeurige artikelen aan één firmwareproduct.
  const isUsableKey = (k: string) => k.length >= 3 && !/^[0-9 ]+$/.test(k);

  const fwIndex = firmwareProducts.map((fp) => ({
    id: fp.id,
    keys: [normalizeForMatch(fp.name), fp.model ? normalizeForMatch(fp.model) : ""].filter(isUsableKey),
  }));

  let created = 0;
  for (const product of products) {
    if (linkedProducts.has(product.id)) continue;
    if (isSparePart(product.sku, product.title)) continue;
    const haystack = normalizeForMatch(`${product.title} ${product.sku}`);
    if (haystack.length < 3) continue;

    // Beste treffer = langste sleutel die volledig in de artikelnaam voorkomt.
    let best: { id: string; len: number } | null = null;
    for (const fp of fwIndex) {
      for (const key of fp.keys) {
        if (!haystack.includes(key)) continue;
        if (!best || key.length > best.len) best = { id: fp.id, len: key.length };
      }
    }
    if (!best || best.len < 4) continue;
    if (alreadyLinked.has(`${product.id}:${best.id}`)) continue;

    await prisma.productFirmwareLink.create({
      data: { productId: product.id, firmwareProductId: best.id, isSuggested: true },
    });
    created++;
  }

  return created;
}

// ─── Voorstellen op basis van factuurhistorie ────────────────────────────────

export interface RegistrationSuggestion {
  customerId: string;
  customerName: string;
  contactId: string | null;
  contactName: string | null;
  email: string;
  firmwareProductId: string;
  firmwareProductLabel: string;
  productSku: string;
  productTitle: string;
  lastInvoiceDate: Date | null;
  lastInvoiceNumber: string | null;
}

/**
 * Kijkt welke gekoppelde ACME-producten een klant gefactureerd heeft gekregen en
 * stelt daarvoor een registratie voor. Slaat klanten over die al geregistreerd
 * staan of zich eerder hebben afgemeld.
 */
export async function suggestRegistrationsFromInvoices(customerId?: string): Promise<RegistrationSuggestion[]> {
  const links = await prisma.productFirmwareLink.findMany({
    include: {
      product: { select: { id: true, sku: true, title: true } },
      firmwareProduct: { select: { id: true, name: true, model: true } },
    },
  });
  if (links.length === 0) return [];

  const byProductId = new Map(links.map((l) => [l.productId, l]));
  const bySku = new Map(links.map((l) => [l.product.sku.toLowerCase(), l]));

  const lines = await prisma.invoiceLine.findMany({
    where: {
      OR: [{ productId: { in: [...byProductId.keys()] } }, { skuSnapshot: { in: links.map((l) => l.product.sku) } }],
      invoice: {
        status: { not: "DRAFT" },
        ...(customerId ? { customerId } : {}),
      },
    },
    select: {
      productId: true,
      skuSnapshot: true,
      invoice: {
        select: {
          invoiceNumber: true,
          invoiceDate: true,
          customerId: true,
          customer: { select: { id: true, companyName: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
        },
      },
    },
    orderBy: { invoice: { invoiceDate: "desc" } },
  });

  // Bestaande registraties (in welke status dan ook) niet nogmaals voorstellen.
  const existing = await prisma.firmwareRegistration.findMany({
    where: customerId ? { customerId } : {},
    select: { customerId: true, firmwareProductId: true, email: true },
  });
  const taken = new Set(
    existing.flatMap((r) => [
      `${r.customerId ?? ""}:${r.firmwareProductId}`,
      `${r.email.toLowerCase()}:${r.firmwareProductId}`,
    ])
  );

  const seen = new Set<string>();
  const out: RegistrationSuggestion[] = [];

  for (const line of lines) {
    const link = (line.productId && byProductId.get(line.productId)) || bySku.get(line.skuSnapshot.toLowerCase());
    if (!link) continue;

    const inv = line.invoice;
    const contact = inv.contact?.isActive ? inv.contact : null;
    const email = contact?.email?.trim();
    if (!contact || !email) continue; // zonder contactpersoon met e-mailadres valt er niets te sturen

    const key = `${inv.customerId}:${link.firmwareProductId}`;
    if (seen.has(key) || taken.has(key) || taken.has(`${email.toLowerCase()}:${link.firmwareProductId}`)) continue;
    seen.add(key);

    out.push({
      customerId: inv.customerId,
      customerName: inv.customer.companyName,
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`.trim(),
      email,
      firmwareProductId: link.firmwareProduct.id,
      firmwareProductLabel: link.firmwareProduct.model
        ? `${link.firmwareProduct.name} (${link.firmwareProduct.model})`
        : link.firmwareProduct.name,
      productSku: link.product.sku,
      productTitle: link.product.title,
      lastInvoiceDate: inv.invoiceDate,
      lastInvoiceNumber: inv.invoiceNumber,
    });
  }

  return out;
}
