#!/usr/bin/env node
/**
 * Teamleader Focus → Distrixs CRM — Full Import Script (Phase 2)
 * ================================================================
 * Imports: contacts, product prices, invoice lines, quote lines
 *
 * Run with:
 *   DATABASE_URL=postgresql://... node scripts/import-teamleader-full.mjs
 *
 * Or if DATABASE_URL is already in environment:
 *   node scripts/import-teamleader-full.mjs
 *
 * Idempotent: existing records are skipped based on external_id / existing lines.
 */

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// ─── DB Setup ──────────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Rate limiting ─────────────────────────────────────────────────────────
const DELAY = 650; // ms between API calls (~92 req/min, safely under 100/min)

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Progress tracking ─────────────────────────────────────────────────────
const counts = {
  contacts: { processed: 0, inserted: 0, skipped: 0, errors: 0 },
  products: { processed: 0, updated: 0, skipped: 0, errors: 0 },
  invoiceLines: { processed: 0, inserted: 0, skipped: 0, errors: 0 },
  quoteLines: { processed: 0, inserted: 0, skipped: 0, errors: 0 },
};

async function writeProgress() {
  const fs = await import('fs/promises');
  await fs.writeFile('/tmp/tl-import-progress.json', JSON.stringify({ timestamp: new Date().toISOString(), counts }, null, 2));
}

// ─── API helper ────────────────────────────────────────────────────────────
async function tlPost(endpoint, body, token) {
  await sleep(DELAY);
  const res = await fetch(`https://api.focus.teamleader.eu/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${endpoint} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.data;
}

/** Fetches all pages for a list endpoint */
async function tlList(endpoint, token, extra = {}) {
  const results = [];
  let page = 1;
  const size = 100;
  while (true) {
    const data = await tlPost(endpoint, { ...extra, page: { size, number: page } }, token);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < size) break;
    page++;
  }
  return results;
}

// ─── Get access token from DB ──────────────────────────────────────────────
async function getAccessToken() {
  const res = await pool.query(
    `SELECT teamleader_access_token FROM company_settings LIMIT 1`
  );
  if (!res.rows.length || !res.rows[0].teamleader_access_token) {
    throw new Error('No Teamleader access token found in company_settings table.');
  }
  return res.rows[0].teamleader_access_token;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — CONTACTS
// ══════════════════════════════════════════════════════════════════════════════
async function importContacts(token) {
  console.log('\n[contacts] Fetching contact list from Teamleader...');

  let contactList;
  try {
    contactList = await tlList('contacts.list', token);
  } catch (err) {
    console.error('[contacts] Failed to fetch list:', err.message);
    return;
  }

  console.log(`[contacts] Found ${contactList.length} contacts total.`);

  for (let i = 0; i < contactList.length; i++) {
    const stub = contactList[i];
    counts.contacts.processed++;

    if (i > 0 && i % 10 === 0) {
      console.log(`[contacts] ${i}/${contactList.length}...`);
      await writeProgress();
    }

    // Check if already imported
    try {
      const existing = await pool.query(
        `SELECT id FROM customer_contacts WHERE external_id = $1`,
        [`tl-contact-${stub.id}`]
      );
      if (existing.rows.length > 0) {
        counts.contacts.skipped++;
        continue;
      }
    } catch (err) {
      console.warn(`[contacts] DB check error for ${stub.id}:`, err.message);
      counts.contacts.errors++;
      continue;
    }

    // Fetch full contact details
    let contact;
    try {
      contact = await tlPost('contacts.info', { id: stub.id }, token);
    } catch (err) {
      console.warn(`[contacts] API error for contact ${stub.id}:`, err.message);
      counts.contacts.errors++;
      continue;
    }

    // Find company link
    const companyLinks = contact.companies || [];
    if (companyLinks.length === 0) {
      counts.contacts.skipped++;
      continue;
    }

    // Use first company link
    const companyLink = companyLinks[0];
    const companyId = companyLink.company?.id;
    if (!companyId) {
      counts.contacts.skipped++;
      continue;
    }

    // Find matching customer in our DB
    let customerId;
    try {
      const custRes = await pool.query(
        `SELECT id FROM customers WHERE external_id = $1`,
        [`tl-company-${companyId}`]
      );
      if (!custRes.rows.length) {
        counts.contacts.skipped++;
        continue;
      }
      customerId = custRes.rows[0].id;
    } catch (err) {
      console.warn(`[contacts] DB lookup error for company ${companyId}:`, err.message);
      counts.contacts.errors++;
      continue;
    }

    // Insert contact
    try {
      const firstName = contact.first_name || '';
      const lastName = contact.last_name || '';
      const email = contact.emails?.[0]?.email || null;
      const phone = contact.telephones?.[0]?.number || null;
      const roleOrFunction = companyLink.function || null;
      const now = new Date().toISOString();

      await pool.query(
        `INSERT INTO customer_contacts
          (id, customer_id, first_name, last_name, email, phone, role_or_function,
           is_primary, is_active, external_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (external_id) DO NOTHING`,
        [
          crypto.randomUUID(),
          customerId,
          firstName,
          lastName,
          email,
          phone,
          roleOrFunction,
          false,
          true,
          `tl-contact-${stub.id}`,
          now,
          now,
        ]
      );
      counts.contacts.inserted++;
    } catch (err) {
      console.warn(`[contacts] Insert error for contact ${stub.id}:`, err.message);
      counts.contacts.errors++;
    }
  }

  console.log(`[contacts] Done. Inserted: ${counts.contacts.inserted}, Skipped: ${counts.contacts.skipped}, Errors: ${counts.contacts.errors}`);
  await writeProgress();
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — PRODUCT PRICES
// ══════════════════════════════════════════════════════════════════════════════
async function updateProductPrices(token) {
  console.log('\n[products] Fetching products with external_id from DB...');

  let dbProducts;
  try {
    const res = await pool.query(
      `SELECT id, external_id, advisory_sell_price
       FROM products
       WHERE external_id LIKE 'tl-product-%'
       ORDER BY id`
    );
    dbProducts = res.rows;
  } catch (err) {
    console.error('[products] DB fetch error:', err.message);
    return;
  }

  console.log(`[products] Found ${dbProducts.length} products to check.`);

  for (let i = 0; i < dbProducts.length; i++) {
    const dbProd = dbProducts[i];
    counts.products.processed++;

    if (i > 0 && i % 10 === 0) {
      console.log(`[products] ${i}/${dbProducts.length}...`);
      await writeProgress();
    }

    // Skip if already has a non-zero price
    if (parseFloat(dbProd.advisory_sell_price) > 0) {
      counts.products.skipped++;
      continue;
    }

    // Extract TL product id from external_id
    const tlId = dbProd.external_id.replace('tl-product-', '');

    let product;
    try {
      product = await tlPost('products.info', { id: tlId }, token);
    } catch (err) {
      console.warn(`[products] API error for product ${tlId}:`, err.message);
      counts.products.errors++;
      continue;
    }

    // Find the price — TL API returns selling_price or price object
    let price = null;
    if (product.selling_price != null) {
      price = typeof product.selling_price === 'object'
        ? product.selling_price.amount
        : product.selling_price;
    } else if (product.price != null) {
      price = typeof product.price === 'object'
        ? product.price.amount
        : product.price;
    } else if (product.unit_price != null) {
      price = typeof product.unit_price === 'object'
        ? product.unit_price.amount
        : product.unit_price;
    }

    if (price == null || isNaN(parseFloat(price))) {
      counts.products.skipped++;
      continue;
    }

    try {
      await pool.query(
        `UPDATE products SET advisory_sell_price = $1, updated_at = NOW() WHERE id = $2`,
        [parseFloat(price), dbProd.id]
      );
      counts.products.updated++;
    } catch (err) {
      console.warn(`[products] Update error for product ${dbProd.id}:`, err.message);
      counts.products.errors++;
    }
  }

  console.log(`[products] Done. Updated: ${counts.products.updated}, Skipped: ${counts.products.skipped}, Errors: ${counts.products.errors}`);
  await writeProgress();
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — INVOICE LINES
// ══════════════════════════════════════════════════════════════════════════════

/** Extract lines from a TL invoice/quotation info response */
function extractLines(data) {
  // TL returns grouped_lines or invoice_lines or quotation_lines
  if (Array.isArray(data.invoice_lines)) return data.invoice_lines;
  if (Array.isArray(data.quotation_lines)) return data.quotation_lines;
  if (Array.isArray(data.grouped_lines)) {
    // grouped_lines is array of sections, each with line_items
    const lines = [];
    for (const group of data.grouped_lines) {
      if (Array.isArray(group.line_items)) lines.push(...group.line_items);
      if (Array.isArray(group.lines)) lines.push(...group.lines);
    }
    return lines;
  }
  if (Array.isArray(data.lines)) return data.lines;
  return [];
}

/** Safely parse a price that might be {amount, currency} or a plain number */
function parsePrice(val) {
  if (val == null) return 0;
  if (typeof val === 'object' && val.amount != null) return parseFloat(val.amount) || 0;
  return parseFloat(val) || 0;
}

async function importInvoiceLines(token) {
  console.log('\n[invoice_lines] Fetching invoices from DB...');

  let dbInvoices;
  try {
    const res = await pool.query(
      `SELECT id, external_id FROM invoices
       WHERE external_id LIKE 'tl-invoice-%'
       ORDER BY id`
    );
    dbInvoices = res.rows;
  } catch (err) {
    console.error('[invoice_lines] DB fetch error:', err.message);
    return;
  }

  console.log(`[invoice_lines] Found ${dbInvoices.length} invoices to process.`);

  for (let i = 0; i < dbInvoices.length; i++) {
    const dbInv = dbInvoices[i];
    counts.invoiceLines.processed++;

    if (i > 0 && i % 10 === 0) {
      console.log(`[invoice_lines] ${i}/${dbInvoices.length}...`);
      await writeProgress();
    }

    // Skip if already has lines
    try {
      const existing = await pool.query(
        `SELECT COUNT(*) as c FROM invoice_lines WHERE invoice_id = $1`,
        [dbInv.id]
      );
      if (parseInt(existing.rows[0].c) > 0) {
        counts.invoiceLines.skipped++;
        continue;
      }
    } catch (err) {
      console.warn(`[invoice_lines] DB check error for invoice ${dbInv.id}:`, err.message);
      counts.invoiceLines.errors++;
      continue;
    }

    // Fetch invoice details from TL
    const tlId = dbInv.external_id.replace('tl-invoice-', '');
    let invoiceData;
    try {
      invoiceData = await tlPost('invoices.info', { id: tlId }, token);
    } catch (err) {
      console.warn(`[invoice_lines] API error for invoice ${tlId}:`, err.message);
      counts.invoiceLines.errors++;
      continue;
    }

    const lines = extractLines(invoiceData);
    if (lines.length === 0) {
      counts.invoiceLines.skipped++;
      continue;
    }

    // Insert lines
    let insertedForThisInvoice = 0;
    for (const line of lines) {
      try {
        const description = line.description || line.title || '';
        const sku = line.product?.code || line.sku || '';
        const qty = parseFloat(line.quantity || line.qty || 1);
        const unitPrice = parsePrice(line.unit_price || line.unit_amount);
        const vatRate = parseFloat(line.tax?.rate ?? line.vat_rate ?? line.tax_rate ?? 21);
        const discount = parseFloat(line.discount?.value ?? line.discount_percentage ?? 0);

        // Calculate totals — gross before discount
        const grossLineTotal = qty * unitPrice;
        // If discount is present, netLineTotal is reduced
        const netLineTotal = grossLineTotal * (1 - discount / 100);
        const vatAmount = netLineTotal * vatRate / 100;

        const now = new Date().toISOString();

        await pool.query(
          `INSERT INTO invoice_lines
            (id, invoice_id, sku_snapshot, title_snapshot, qty,
             gross_unit_price, discount_percent, net_line_total,
             vat_rate, vat_amount, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            crypto.randomUUID(),
            dbInv.id,
            sku,
            description,
            qty,
            unitPrice,
            discount,
            netLineTotal,
            vatRate,
            vatAmount,
            now,
            now,
          ]
        );
        insertedForThisInvoice++;
        counts.invoiceLines.inserted++;
      } catch (err) {
        console.warn(`[invoice_lines] Line insert error for invoice ${dbInv.id}:`, err.message);
        counts.invoiceLines.errors++;
      }
    }

    if (insertedForThisInvoice === 0) {
      counts.invoiceLines.skipped++;
    }
  }

  console.log(`[invoice_lines] Done. Inserted: ${counts.invoiceLines.inserted}, Skipped: ${counts.invoiceLines.skipped}, Errors: ${counts.invoiceLines.errors}`);
  await writeProgress();
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — QUOTE LINES
// ══════════════════════════════════════════════════════════════════════════════
async function importQuoteLines(token) {
  console.log('\n[quote_lines] Fetching quotes from DB...');

  let dbQuotes;
  try {
    const res = await pool.query(
      `SELECT id, external_id FROM quotes
       WHERE external_id LIKE 'tl-quotation-%'
       ORDER BY id`
    );
    dbQuotes = res.rows;
  } catch (err) {
    console.error('[quote_lines] DB fetch error:', err.message);
    return;
  }

  console.log(`[quote_lines] Found ${dbQuotes.length} quotes to process.`);

  for (let i = 0; i < dbQuotes.length; i++) {
    const dbQuote = dbQuotes[i];
    counts.quoteLines.processed++;

    if (i > 0 && i % 10 === 0) {
      console.log(`[quote_lines] ${i}/${dbQuotes.length}...`);
      await writeProgress();
    }

    // Skip if already has lines
    try {
      const existing = await pool.query(
        `SELECT COUNT(*) as c FROM quote_lines WHERE quote_id = $1`,
        [dbQuote.id]
      );
      if (parseInt(existing.rows[0].c) > 0) {
        counts.quoteLines.skipped++;
        continue;
      }
    } catch (err) {
      console.warn(`[quote_lines] DB check error for quote ${dbQuote.id}:`, err.message);
      counts.quoteLines.errors++;
      continue;
    }

    // Extract TL quotation id (external_id format: tl-quotation-<id>)
    const tlId = dbQuote.external_id.replace('tl-quotation-', '');
    let quotationData;
    try {
      quotationData = await tlPost('quotations.info', { id: tlId }, token);
    } catch (err) {
      console.warn(`[quote_lines] API error for quotation ${tlId}:`, err.message);
      counts.quoteLines.errors++;
      continue;
    }

    const lines = extractLines(quotationData);
    if (lines.length === 0) {
      counts.quoteLines.skipped++;
      continue;
    }

    // Insert lines — quote_lines requires cost_snapshot and expected_margin_snapshot
    let insertedForThisQuote = 0;
    for (const line of lines) {
      try {
        const description = line.description || line.title || '';
        const sku = line.product?.code || line.sku || '';
        const qty = parseFloat(line.quantity || line.qty || 1);
        const unitPrice = parsePrice(line.unit_price || line.unit_amount);
        const vatRate = parseFloat(line.tax?.rate ?? line.vat_rate ?? line.tax_rate ?? 21);
        const discount = parseFloat(line.discount?.value ?? line.discount_percentage ?? 0);

        const grossLineTotal = qty * unitPrice;
        const netLineTotal = grossLineTotal * (1 - discount / 100);
        const vatAmount = netLineTotal * vatRate / 100;

        // cost_snapshot and expected_margin_snapshot are required columns —
        // we don't have real cost data from TL, so default to 0.
        const costSnapshot = 0;
        const expectedMarginSnapshot = 0;

        const now = new Date().toISOString();

        await pool.query(
          `INSERT INTO quote_lines
            (id, quote_id, sku_snapshot, title_snapshot, qty,
             gross_unit_price, discount_percent, net_line_total,
             vat_rate, vat_amount, cost_snapshot, expected_margin_snapshot,
             created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            crypto.randomUUID(),
            dbQuote.id,
            sku,
            description,
            qty,
            unitPrice,
            discount,
            netLineTotal,
            vatRate,
            vatAmount,
            costSnapshot,
            expectedMarginSnapshot,
            now,
            now,
          ]
        );
        insertedForThisQuote++;
        counts.quoteLines.inserted++;
      } catch (err) {
        console.warn(`[quote_lines] Line insert error for quote ${dbQuote.id}:`, err.message);
        counts.quoteLines.errors++;
      }
    }

    if (insertedForThisQuote === 0) {
      counts.quoteLines.skipped++;
    }
  }

  console.log(`[quote_lines] Done. Inserted: ${counts.quoteLines.inserted}, Skipped: ${counts.quoteLines.skipped}, Errors: ${counts.quoteLines.errors}`);
  await writeProgress();
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('=== Teamleader Full Import — Phase 2 ===');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Delay between API calls: ${DELAY}ms (~${Math.floor(60000 / DELAY)} req/min)\n`);

  // 1. Get access token
  let token;
  try {
    token = await getAccessToken();
    console.log('[auth] Access token retrieved from DB.');
  } catch (err) {
    console.error('[auth] FATAL:', err.message);
    process.exit(1);
  }

  // 2. Contacts
  try {
    await importContacts(token);
  } catch (err) {
    console.error('[contacts] Section failed:', err.message);
  }

  // 3. Product prices
  try {
    await updateProductPrices(token);
  } catch (err) {
    console.error('[products] Section failed:', err.message);
  }

  // 4. Invoice lines
  try {
    await importInvoiceLines(token);
  } catch (err) {
    console.error('[invoice_lines] Section failed:', err.message);
  }

  // 5. Quote lines
  try {
    await importQuoteLines(token);
  } catch (err) {
    console.error('[quote_lines] Section failed:', err.message);
  }

  // Final summary
  await writeProgress();
  console.log('\n=== Import Complete ===');
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Finished at: ${new Date().toISOString()}`);
  console.log('Progress file written to: /tmp/tl-import-progress.json');

  await pool.end();
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
