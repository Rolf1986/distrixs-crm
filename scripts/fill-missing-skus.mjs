#!/usr/bin/env node
/**
 * Distrixs CRM — Vul ontbrekende SKU's in op factuur- en offerteregels
 * =====================================================================
 * Matcht regels zonder SKU aan producten op basis van de titel (omschrijving).
 * Werkt met exacte match én fuzzy (case-insensitive, whitespace-genormaliseerd).
 *
 * Gebruik:
 *   DATABASE_URL=postgresql://... node scripts/fill-missing-skus.mjs
 *
 * Veilig om meerdere keren te draaien (overschrijft alleen lege SKU's).
 */

import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL niet ingesteld');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Normaliseer tekst voor fuzzy match */
function normalize(s) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Distrixs CRM — Vul ontbrekende SKU\'s in    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Gestart: ${new Date().toISOString()}\n`);

  // Laad alle producten met SKU
  const productsRes = await pool.query(
    `SELECT id, sku, title FROM products WHERE sku IS NOT NULL AND sku != '' ORDER BY title`
  );
  const products = productsRes.rows;
  console.log(`[producten] ${products.length} producten met SKU geladen`);

  // Bouw lookup maps
  const titleMap = new Map();  // normalized title → sku
  const skuSet = new Set();    // alle bekende sku's (lowercase)
  for (const p of products) {
    titleMap.set(normalize(p.title), p.sku);
    skuSet.add(p.sku.toLowerCase().trim());
  }

  /**
   * Probeer SKU te vinden voor een regelbeschrijving via drie methodes:
   * 1. Direct: sku_snapshot al gevuld (overgeslagen)
   * 2. TL-formaat "{SKU}: {omschrijving}" → extraheer prefix als SKU
   * 3. Exacte match op productnaam
   */
  function findSku(titleSnapshot) {
    // Methode 2: TL-formaat "CODE: omschrijving"
    const colonIdx = titleSnapshot.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      const prefix = titleSnapshot.slice(0, colonIdx).trim();
      if (skuSet.has(prefix.toLowerCase())) {
        // Zoek exacte SKU (bewaar originele casing uit products tabel)
        const found = products.find(p => p.sku.toLowerCase() === prefix.toLowerCase());
        if (found) return { sku: found.sku, method: 'colon-prefix' };
      }
      // Zelfs als we de SKU niet in products vinden, gebruik de prefix als SKU
      // (bijv. voor free-text regels met productcode prefix)
      if (prefix.length > 0 && prefix.length <= 20 && /^[A-Za-z0-9\-_./]+$/.test(prefix)) {
        return { sku: prefix, method: 'colon-prefix-literal' };
      }
    }
    // Methode 3: exacte naam-match
    const byTitle = titleMap.get(normalize(titleSnapshot));
    if (byTitle) return { sku: byTitle, method: 'title-match' };

    return null;
  }

  // ── Factuurregels ──────────────────────────────────────────────────────────
  const invLinesRes = await pool.query(
    `SELECT id, title_snapshot, sku_snapshot FROM invoice_lines
     WHERE (sku_snapshot IS NULL OR sku_snapshot = '')
       AND title_snapshot IS NOT NULL AND title_snapshot != ''`
  );
  console.log(`\n[factuurregels] ${invLinesRes.rows.length} regels zonder SKU gevonden`);

  let invMatched = 0;
  let invSkipped = 0;
  const methodCounts = {};

  for (const line of invLinesRes.rows) {
    const result = findSku(line.title_snapshot);
    if (result) {
      await pool.query(
        `UPDATE invoice_lines SET sku_snapshot = $1 WHERE id = $2`,
        [result.sku, line.id]
      );
      invMatched++;
      methodCounts[result.method] = (methodCounts[result.method] || 0) + 1;
    } else {
      invSkipped++;
    }
  }

  console.log(`[factuurregels] Gematcht: ${invMatched}, Geen match: ${invSkipped}`);
  console.log(`[factuurregels] Methoden: ${JSON.stringify(methodCounts)}`);

  // ── Offerteregels ──────────────────────────────────────────────────────────
  const quoteLinesRes = await pool.query(
    `SELECT id, title_snapshot, sku_snapshot FROM quote_lines
     WHERE (sku_snapshot IS NULL OR sku_snapshot = '')
       AND title_snapshot IS NOT NULL AND title_snapshot != ''`
  );
  console.log(`\n[offerteregels] ${quoteLinesRes.rows.length} regels zonder SKU gevonden`);

  let quoteMatched = 0;
  let quoteSkipped = 0;
  const quoteMethodCounts = {};

  for (const line of quoteLinesRes.rows) {
    const result = findSku(line.title_snapshot);
    if (result) {
      await pool.query(
        `UPDATE quote_lines SET sku_snapshot = $1 WHERE id = $2`,
        [result.sku, line.id]
      );
      quoteMatched++;
      quoteMethodCounts[result.method] = (quoteMethodCounts[result.method] || 0) + 1;
    } else {
      quoteSkipped++;
    }
  }

  console.log(`[offerteregels] Gematcht: ${quoteMatched}, Geen match: ${quoteSkipped}`);
  console.log(`[offerteregels] Methoden: ${JSON.stringify(quoteMethodCounts)}`);

  console.log(`[offerteregels] Gematcht: ${quoteMatched}, Geen match: ${quoteSkipped}`);

  // ── Samenvatting ───────────────────────────────────────────────────────────
  const totalMatched = invMatched + quoteMatched;
  const totalSkipped = invSkipped + quoteSkipped;
  const matchPct = totalMatched + totalSkipped > 0
    ? Math.round((totalMatched / (totalMatched + totalSkipped)) * 100)
    : 0;

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SAMENVATTING                                 ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Factuurregels gematcht:  ${invMatched}`);
  console.log(`Offerteregels gematcht:  ${quoteMatched}`);
  console.log(`Totaal gematcht:         ${totalMatched} (${matchPct}%)`);
  console.log(`Geen match gevonden:     ${totalSkipped}`);

  if (totalSkipped > 0) {
    // Toon de meest voorkomende niet-gematchte omschrijvingen
    const unmatched = await pool.query(`
      SELECT title_snapshot, COUNT(*) as n
      FROM (
        SELECT title_snapshot FROM invoice_lines WHERE (sku_snapshot IS NULL OR sku_snapshot = '') AND title_snapshot != ''
        UNION ALL
        SELECT title_snapshot FROM quote_lines WHERE (sku_snapshot IS NULL OR sku_snapshot = '') AND title_snapshot != ''
      ) t
      GROUP BY title_snapshot
      ORDER BY n DESC
      LIMIT 15
    `);
    if (unmatched.rows.length > 0) {
      console.log('\nMeest voorkomende niet-gematchte omschrijvingen:');
      for (const r of unmatched.rows) {
        console.log(`  ${String(r.n).padStart(4)}×  ${r.title_snapshot}`);
      }
    }
  }

  console.log(`\nKlaar: ${new Date().toISOString()}`);
  await pool.end();
}

main().catch(async err => {
  console.error('FATAL:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
