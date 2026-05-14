#!/usr/bin/env node
/**
 * Teamleader → Distrixs CRM — Klanten Sync
 * ==========================================
 * Voegt ALLEEN nieuwe/ontbrekende klanten toe vanuit Teamleader.
 * Bestaande klanten worden NIET aangeraakt.
 * Importeert ook gearchiveerde bedrijven (die bij de eerste import werden overgeslagen).
 *
 * Gebruik:
 *   DATABASE_URL=postgresql://... node scripts/sync-customers.mjs
 *   of als DATABASE_URL al in de omgeving staat:
 *   node scripts/sync-customers.mjs
 */

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const DELAY = 650; // ms tussen API calls

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL niet ingesteld');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tlPost(endpoint, body, token) {
  await sleep(DELAY);
  const res = await fetch(`https://api.focus.teamleader.eu/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TL ${endpoint} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()).data;
}

async function tlList(endpoint, token, extra = {}) {
  const results = [];
  let page = 1;
  while (true) {
    const data = await tlPost(endpoint, { ...extra, page: { size: 100, number: page } }, token);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

async function getAccessToken() {
  if (process.env.TEAMLEADER_ACCESS_TOKEN) return process.env.TEAMLEADER_ACCESS_TOKEN;
  const res = await pool.query(`SELECT teamleader_access_token FROM company_settings LIMIT 1`);
  if (!res.rows.length || !res.rows[0].teamleader_access_token)
    throw new Error('Geen Teamleader token gevonden in DB of omgeving.');
  return res.rows[0].teamleader_access_token;
}

async function getSystemUserId() {
  const res = await pool.query(`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`);
  if (!res.rows.length) throw new Error('Geen ADMIN gebruiker gevonden.');
  return res.rows[0].id;
}

async function getNextCustomerNumber() {
  // Bepaal volgend klantnummer op basis van hoogste bestaande nummer
  const res = await pool.query(`
    SELECT customer_number FROM customers
    WHERE customer_number ~ '^K-[0-9]{4}-[0-9]+'
    ORDER BY
      CAST(split_part(customer_number, '-', 3) AS INTEGER) DESC
    LIMIT 1
  `);
  if (!res.rows.length) return 'K-2026-001';
  const last = res.rows[0].customer_number; // bijv. K-2026-347
  const parts = last.split('-');
  const year = parts[1];
  const num = parseInt(parts[2]) + 1;
  return `K-${year}-${String(num).padStart(3, '0')}`;
}

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  Distrixs CRM — Klanten Sync (bijwerken)  ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`Gestart: ${new Date().toISOString()}\n`);

  const token = await getAccessToken();
  const systemUserId = await getSystemUserId();
  console.log(`[auth] System user: ${systemUserId}`);

  // Haal alle bedrijven op uit TL — inclusief gearchiveerde
  console.log('\n[klanten] Ophalen uit Teamleader (incl. gearchiveerd)...');
  const allCompanies = await tlList('companies.list', token);
  console.log(`[klanten] ${allCompanies.length} bedrijven gevonden in TL`);

  // Haal bestaande external_ids op uit DB (voor snelle lookup)
  const existingRes = await pool.query(`SELECT external_id FROM customers WHERE external_id IS NOT NULL`);
  const existingIds = new Set(existingRes.rows.map(r => r.external_id));
  console.log(`[klanten] ${existingIds.size} klanten al in DB`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let nextNumSeq = null; // lazy: bepaal bij eerste insert

  for (let i = 0; i < allCompanies.length; i++) {
    const c = allCompanies[i];

    if (i > 0 && i % 100 === 0) {
      console.log(`[klanten] ${i}/${allCompanies.length} (nieuw: ${inserted}, skip: ${skipped}, fouten: ${errors})`);
    }

    // Controleer of klant al bestaat (beide external_id formaten)
    const extIdNew = `tl-company-${c.id}`;
    const extIdOld = c.id; // bare UUID (oud importformaat)

    if (existingIds.has(extIdNew) || existingIds.has(extIdOld)) {
      skipped++;
      continue;
    }

    // Nieuwe klant — klantnummer bepalen
    try {
      // Haal huidig hoogste nummer op bij eerste insert of na elke insert
      const numRes = await pool.query(`
        SELECT customer_number FROM customers
        WHERE customer_number ~ '^K-[0-9]{4}-[0-9]+'
        ORDER BY CAST(split_part(customer_number, '-', 3) AS INTEGER) DESC
        LIMIT 1
      `);
      let nextNum;
      if (!numRes.rows.length) {
        nextNum = 'K-2026-001';
      } else {
        const last = numRes.rows[0].customer_number;
        const parts = last.split('-');
        const year = parts[1];
        const seq = parseInt(parts[2]) + 1;
        nextNum = `K-${year}-${String(seq).padStart(3, '0')}`;
      }

      // Status mapping
      let status;
      switch (c.status) {
        case 'active':   status = 'ACTIVE';   break;
        case 'archived': status = 'INACTIVE'; break;
        default:         status = 'PROSPECT'; break;
      }

      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO customers
          (id, customer_number, company_name, kvk_number, vat_number,
           status, default_payment_term, external_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          crypto.randomUUID(),
          nextNum,
          c.name || 'Onbekend',
          c.national_identification_number || null,
          c.vat_number || null,
          status,
          c.payment_term_days ? Math.round(c.payment_term_days) : 30,
          extIdNew,
          now,
          now,
        ]
      );

      existingIds.add(extIdNew); // voorkom dubbel in zelfde run
      inserted++;
    } catch (err) {
      console.warn(`[klanten] Fout voor bedrijf ${c.id} (${c.name}):`, err.message);
      errors++;
    }
  }

  console.log(`\n[klanten] Klaar.`);
  console.log(`  Nieuw ingevoerd: ${inserted}`);
  console.log(`  Overgeslagen (al in DB): ${skipped}`);
  console.log(`  Fouten: ${errors}`);
  console.log(`Klaar: ${new Date().toISOString()}`);

  await pool.end();
}

main().catch(async err => {
  console.error('FATAL:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
