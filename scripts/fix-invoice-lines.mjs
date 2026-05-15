#!/usr/bin/env node
/**
 * Distrixs CRM — Herstel factuurregels
 * ======================================
 * Haalt regeldetails op voor alle facturen die nog geen regels hebben.
 * Bevat automatische token-refresh zodat het bij lange runs niet faalt.
 *
 * Gebruik:
 *   DATABASE_URL=postgresql://... node scripts/fix-invoice-lines.mjs
 */

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const DELAY = 650; // ms tussen API calls
const CLIENT_ID = '38fb7bf0cfe0e21d64b4441f0a6be867';
const CLIENT_SECRET = 'b04fed6f12716b2b0516144f236ae969';
// Token verversen elke 50 minuten (token geldig 60 min)
const REFRESH_INTERVAL_MS = 50 * 60 * 1000;

if (!process.env.DATABASE_URL) { console.error('ERROR: DATABASE_URL niet ingesteld'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parsePrice(val) {
  if (val == null) return 0;
  if (typeof val === 'object' && val.amount != null) return parseFloat(val.amount) || 0;
  return parseFloat(val) || 0;
}

function extractLines(data) {
  if (Array.isArray(data.invoice_lines)) return data.invoice_lines;
  if (Array.isArray(data.grouped_lines)) {
    const lines = [];
    for (const g of data.grouped_lines) {
      if (Array.isArray(g.line_items)) lines.push(...g.line_items);
      else if (Array.isArray(g.lines)) lines.push(...g.lines);
    }
    return lines;
  }
  if (Array.isArray(data.lines)) return data.lines;
  return [];
}

// ─── Token beheer ────────────────────────────────────────────────────────────

let currentToken = null;
let lastRefreshedAt = 0;

async function getToken() {
  const now = Date.now();
  // Ververs token als hij ouder is dan 50 min
  if (currentToken && (now - lastRefreshedAt) < REFRESH_INTERVAL_MS) {
    return currentToken;
  }
  await refreshToken();
  return currentToken;
}

async function refreshToken() {
  console.log('[token] Token verversen...');
  // Haal refresh token op uit DB
  const res = await pool.query(`SELECT teamleader_refresh_token FROM company_settings LIMIT 1`);
  if (!res.rows.length || !res.rows[0].teamleader_refresh_token) {
    throw new Error('Geen refresh token in DB gevonden.');
  }
  const refreshToken = res.rows[0].teamleader_refresh_token;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const r = await fetch('https://focus.teamleader.eu/oauth2/access_token', {
    method: 'POST',
    body: params,
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Token refresh mislukt: ${r.status} ${t.slice(0, 200)}`);
  }

  const data = await r.json();
  currentToken = data.access_token;
  lastRefreshedAt = Date.now();

  // Sla nieuwe tokens op in DB
  await pool.query(
    `UPDATE company_settings SET
       teamleader_access_token = $1,
       teamleader_refresh_token = $2,
       teamleader_token_expires_at = NOW() + INTERVAL '1 hour'`,
    [data.access_token, data.refresh_token]
  );
  console.log('[token] Token vernieuwd en opgeslagen.');
}

async function tlPost(endpoint, body) {
  const token = await getToken();
  await sleep(DELAY);
  const res = await fetch(`https://api.focus.teamleader.eu/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    // Token verlopen — vernieuwen en opnieuw proberen
    console.log('[token] 401 ontvangen, token verversen en opnieuw proberen...');
    await refreshToken();
    return tlPost(endpoint, body);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TL ${endpoint} → ${res.status}: ${t.slice(0, 200)}`);
  }
  return (await res.json()).data;
}

// ─── Hoofdlogica ─────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Distrixs CRM — Herstel factuurregels      ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`Gestart: ${new Date().toISOString()}\n`);

  // Initieel token laden
  await refreshToken();

  // Haal alle facturen op zonder regels
  const res = await pool.query(`
    SELECT i.id, i.external_id, i.invoice_number
    FROM invoices i
    WHERE i.external_id LIKE 'tl-invoice-%'
      AND NOT EXISTS (
        SELECT 1 FROM invoice_lines il WHERE il.invoice_id = i.id
      )
    ORDER BY i.invoice_number
  `);

  const invoices = res.rows;
  console.log(`[regels] ${invoices.length} facturen zonder regels gevonden.\n`);

  if (invoices.length === 0) {
    console.log('Niets te doen — alle facturen hebben al regels!');
    await pool.end();
    return;
  }

  let linesInserted = 0;
  let invoicesDone = 0;
  let errors = 0;

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];

    if (i > 0 && i % 50 === 0) {
      console.log(`[regels] ${i}/${invoices.length} — ${linesInserted} regels ingevoerd, ${errors} fouten`);
    }

    try {
      const tlId = inv.external_id.replace('tl-invoice-', '');
      const data = await tlPost('invoices.info', { id: tlId });
      const lines = extractLines(data);

      if (lines.length === 0) {
        // Factuur heeft geen regels in TL — normaal voor sommige oudere facturen
        invoicesDone++;
        continue;
      }

      for (const line of lines) {
        const description = line.description || line.title || '';
        const sku = line.product?.code || line.sku || '';
        const qty = parseFloat(line.quantity ?? line.qty ?? 1);
        const unitPrice = parsePrice(line.unit_price ?? line.unit_amount);
        const vatRate = parseFloat(line.tax?.rate ?? line.vat_rate ?? line.tax_rate ?? 21);
        const discount = parseFloat(line.discount?.value ?? line.discount_percentage ?? 0);
        const grossLineTotal = qty * unitPrice;
        const netLineTotal = grossLineTotal * (1 - discount / 100);
        const vatLineAmount = netLineTotal * vatRate / 100;
        const now = new Date().toISOString();

        await pool.query(
          `INSERT INTO invoice_lines
            (id, invoice_id, sku_snapshot, title_snapshot, qty,
             gross_unit_price, discount_percent, net_line_total,
             vat_rate, vat_amount, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            crypto.randomUUID(), inv.id, sku, description, qty,
            unitPrice, discount, netLineTotal, vatRate, vatLineAmount,
            now, now,
          ]
        );
        linesInserted++;
      }
      invoicesDone++;
    } catch (err) {
      console.warn(`[regels] Fout bij ${inv.invoice_number}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  SAMENVATTING                               ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`Facturen verwerkt: ${invoicesDone}`);
  console.log(`Regels ingevoerd:  ${linesInserted}`);
  console.log(`Fouten:            ${errors}`);
  console.log(`Klaar: ${new Date().toISOString()}`);

  await pool.end();
}

main().catch(async err => {
  console.error('FATAL:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
