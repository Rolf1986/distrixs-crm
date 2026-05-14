#!/usr/bin/env node
/**
 * Teamleader Focus → Distrixs CRM — Re-import Deals, Quotes & Invoices
 * ======================================================================
 * This script replaces the old messy Teamleader import.
 *
 * Phase 1 — CLEANUP:
 *   Deletes all TL-imported deals, quotes, invoices (and their lines).
 *   Keeps customers, contacts, products untouched.
 *
 * Phase 2 — REIMPORT:
 *   Deals:    correct deal numbers (D-YYYY-{ref}), correct created_at from TL
 *   Quotes:   correct quote numbers (Q-YYYY-{ref}), lines from quotations.info
 *   Invoices: correct invoice numbers (F-YYYY-NNN), lines from invoices.info
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/reimport-deals-quotes-invoices.mjs
 *
 *   The access token is loaded from env var TEAMLEADER_ACCESS_TOKEN first,
 *   falling back to the company_settings table in the DB.
 */

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// ─── Config ────────────────────────────────────────────────────────────────────

const DELAY = 650; // ms between Teamleader API calls (~92 req/min, safely under 100/min)
const PAGE_SIZE = 100;

// ─── DB setup ──────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Parse a TL price value that may be {amount, currency} or a plain number. */
function parsePrice(val) {
  if (val == null) return 0;
  if (typeof val === 'object' && val.amount != null) return parseFloat(val.amount) || 0;
  return parseFloat(val) || 0;
}

/** Extract flat line array from a TL info response (invoice or quotation). */
function extractLines(data) {
  if (Array.isArray(data.invoice_lines)) return data.invoice_lines;
  if (Array.isArray(data.quotation_lines)) return data.quotation_lines;
  if (Array.isArray(data.grouped_lines)) {
    const lines = [];
    for (const group of data.grouped_lines) {
      if (Array.isArray(group.line_items)) lines.push(...group.line_items);
      else if (Array.isArray(group.lines)) lines.push(...group.lines);
    }
    return lines;
  }
  if (Array.isArray(data.lines)) return data.lines;
  return [];
}

/** Add N days to a Date, return ISO date string YYYY-MM-DD. */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Teamleader API helpers ────────────────────────────────────────────────────

/**
 * POST to a Teamleader Focus API endpoint.
 * Respects the rate-limit delay before each call.
 */
async function tlPost(endpoint, body, token) {
  await sleep(DELAY);
  const res = await fetch(`https://api.focus.teamleader.eu/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TL ${endpoint} → ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.data;
}

/**
 * Fetch all pages from a list endpoint.
 * Extra body params (e.g. filter) can be passed via `extra`.
 */
async function tlList(endpoint, token, extra = {}) {
  const results = [];
  let page = 1;
  while (true) {
    const data = await tlPost(endpoint, { ...extra, page: { size: PAGE_SIZE, number: page } }, token);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return results;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

async function getAccessToken() {
  // Prefer env var
  if (process.env.TEAMLEADER_ACCESS_TOKEN) {
    console.log('[auth] Using TEAMLEADER_ACCESS_TOKEN from environment.');
    return process.env.TEAMLEADER_ACCESS_TOKEN;
  }
  // Fall back to DB
  const res = await pool.query(`SELECT teamleader_access_token FROM company_settings LIMIT 1`);
  if (!res.rows.length || !res.rows[0].teamleader_access_token) {
    throw new Error('No Teamleader access token found in env or company_settings table.');
  }
  console.log('[auth] Using access token from company_settings table.');
  return res.rows[0].teamleader_access_token;
}

async function getSystemUserId() {
  const res = await pool.query(`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`);
  if (!res.rows.length) throw new Error('No ADMIN user found in users table.');
  return res.rows[0].id;
}

// ─── Customer lookup ───────────────────────────────────────────────────────────

/**
 * Look up a local customer ID by Teamleader company ID.
 * Tries `tl-company-{id}` first, then the bare TL ID as fallback
 * (older import scripts stored bare IDs in external_id).
 */
async function findCustomerId(tlCompanyId) {
  if (!tlCompanyId) return null;

  // Primary: new-style external_id
  let res = await pool.query(
    `SELECT id FROM customers WHERE external_id = $1`,
    [`tl-company-${tlCompanyId}`]
  );
  if (res.rows.length) return res.rows[0].id;

  // Fallback: bare TL ID (legacy import)
  res = await pool.query(
    `SELECT id FROM customers WHERE external_id = $1`,
    [tlCompanyId]
  );
  if (res.rows.length) return res.rows[0].id;

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — CLEANUP
// ══════════════════════════════════════════════════════════════════════════════

async function runCleanup() {
  console.log('\n══════════════════════════════════════════');
  console.log('PHASE 1 — CLEANUP');
  console.log('══════════════════════════════════════════');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Invoice lines → invoices
    let r = await client.query(
      `DELETE FROM invoice_lines
       WHERE invoice_id IN (
         SELECT id FROM invoices WHERE external_id LIKE 'tl-invoice-%'
       )`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} invoice_lines`);

    r = await client.query(
      `DELETE FROM invoices WHERE external_id LIKE 'tl-invoice-%'`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} invoices`);

    // 2. Quote lines → quotes
    r = await client.query(
      `DELETE FROM quote_lines
       WHERE quote_id IN (
         SELECT id FROM quotes WHERE external_id LIKE 'tl-quotation-%'
       )`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} quote_lines`);

    r = await client.query(
      `DELETE FROM quotes WHERE external_id LIKE 'tl-quotation-%'`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} quotes`);

    // 3. Handle remaining FK references to TL deals.
    //    quotes.deal_id is NOT NULL → must delete any remaining quotes referencing TL deals
    r = await client.query(
      `DELETE FROM quote_lines WHERE quote_id IN (
         SELECT id FROM quotes WHERE deal_id IN (
           SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%'
         )
       )`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} quote_lines for remaining deal-linked quotes`);

    r = await client.query(
      `DELETE FROM quotes
       WHERE deal_id IN (SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%')`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} remaining deal-linked quotes`);

    // invoices.deal_id is nullable → NULL it out
    r = await client.query(
      `UPDATE invoices SET deal_id = NULL
       WHERE deal_id IN (SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%')`
    );
    console.log(`[cleanup] Nulled deal_id on ${r.rowCount} remaining invoices`);

    r = await client.query(
      `UPDATE purchase_orders SET deal_id = NULL
       WHERE deal_id IN (SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%')`
    );
    console.log(`[cleanup] Nulled deal_id on ${r.rowCount} purchase_orders`);

    r = await client.query(
      `UPDATE recurring_invoices SET deal_id = NULL
       WHERE deal_id IN (SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%')`
    );
    console.log(`[cleanup] Nulled deal_id on ${r.rowCount} recurring_invoices`);

    r = await client.query(
      `UPDATE emails SET deal_id = NULL
       WHERE deal_id IN (SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%')`
    );
    console.log(`[cleanup] Nulled deal_id on ${r.rowCount} emails`);

    r = await client.query(
      `UPDATE shipments SET deal_id = NULL
       WHERE deal_id IN (SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%')`
    );
    console.log(`[cleanup] Nulled deal_id on ${r.rowCount} shipments`);

    r = await client.query(
      `UPDATE activities SET deal_id = NULL
       WHERE deal_id IN (SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%')`
    );
    console.log(`[cleanup] Nulled deal_id on ${r.rowCount} activities`);

    // 4. Delivery notes (lines cascade automatically)
    r = await client.query(
      `DELETE FROM delivery_notes
       WHERE deal_id IN (
         SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%'
       )`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} delivery_notes (lines cascade)`);

    // 5. Order confirmations
    r = await client.query(
      `DELETE FROM order_confirmations
       WHERE deal_id IN (
         SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%'
       )`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} order_confirmations`);

    // 6. Deal lines (explicit, even though deal delete would cascade)
    r = await client.query(
      `DELETE FROM deal_lines
       WHERE deal_id IN (
         SELECT id FROM deals WHERE external_id LIKE 'tl-deal-%'
       )`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} deal_lines`);

    // 7. Deals
    r = await client.query(
      `DELETE FROM deals WHERE external_id LIKE 'tl-deal-%'`
    );
    console.log(`[cleanup] Deleted ${r.rowCount} deals`);

    await client.query('COMMIT');
    console.log('[cleanup] Transaction committed. Cleanup complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[cleanup] TRANSACTION ROLLED BACK:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2a — IMPORT DEALS
// ══════════════════════════════════════════════════════════════════════════════

async function importDeals(token, systemUserId) {
  console.log('\n══════════════════════════════════════════');
  console.log('PHASE 2a — IMPORT DEALS');
  console.log('══════════════════════════════════════════');

  let dealList;
  try {
    console.log('[deals] Fetching deals from Teamleader...');
    dealList = await tlList('deals.list', token);
  } catch (err) {
    console.error('[deals] Failed to fetch list:', err.message);
    return { inserted: 0, errors: 0 };
  }

  console.log(`[deals] Found ${dealList.length} deals.`);

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < dealList.length; i++) {
    const d = dealList[i];

    if (i > 0 && i % 50 === 0) {
      console.log(`[deals] Progress: ${i}/${dealList.length} (inserted ${inserted}, errors ${errors})`);
    }

    try {
      // ── Resolve deal number ──────────────────────────────────────────────
      // TL `reference` is a short number like "4148".
      // Year comes from TL's created_at timestamp.
      const tlCreatedAt = d.created_at ? new Date(d.created_at) : new Date();
      const year = tlCreatedAt.getFullYear();
      const ref = d.reference || d.id.slice(0, 8); // fallback: first 8 chars of UUID
      // Pad reference to at least 4 digits (preserves longer refs as-is)
      const refPadded = String(ref).padStart(4, '0');
      const dealNumber = `D-${year}-${refPadded}`;

      // ── Resolve customer ─────────────────────────────────────────────────
      // TL deal has lead.customer (type=company, id=<tlCompanyId>)
      const tlCompanyId =
        d.lead?.customer?.id ||
        d.customer?.id ||
        null;
      const customerId = await findCustomerId(tlCompanyId);

      // ── Status mapping ───────────────────────────────────────────────────
      let status;
      switch (d.status) {
        case 'won':  status = 'WON';  break;
        case 'lost': status = 'LOST'; break;
        default:     status = 'NEW';  break;
      }

      // Skip deals without a customer (customer_id is required in DB)
      if (!customerId) {
        console.warn(`[deals] No customer found for deal ${d.id} (tlCompanyId: ${tlCompanyId}), skipping`);
        errors++;
        continue;
      }

      // ── Insert ───────────────────────────────────────────────────────────
      const createdAtIso = tlCreatedAt.toISOString();
      const externalId = `tl-deal-${d.id}`;

      await pool.query(
        `INSERT INTO deals
          (id, deal_number, title, customer_id, status,
           win_probability, expected_close_date, notes,
           created_by, external_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (external_id) DO NOTHING`,
        [
          crypto.randomUUID(),
          dealNumber,
          d.title || dealNumber,
          customerId,
          status,
          // TL stores probability as 0–1 (e.g. 0.75); our DB stores 0–100 (INT)
          d.estimated_probability != null ? Math.round(parseFloat(d.estimated_probability) * 100) : null,
          d.estimated_closing_date || null,
          null, // notes not available in TL deals.list
          systemUserId,
          externalId,
          createdAtIso,
          createdAtIso, // updated_at = same as created_at from TL
        ]
      );
      inserted++;
    } catch (err) {
      console.warn(`[deals] Error for deal ${d.id}:`, err.message);
      errors++;
    }
  }

  console.log(`[deals] Done. Inserted: ${inserted}, Errors: ${errors}`);
  return { inserted, errors };
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2b — IMPORT QUOTES
// ══════════════════════════════════════════════════════════════════════════════

async function importQuotes(token, systemUserId) {
  console.log('\n══════════════════════════════════════════');
  console.log('PHASE 2b — IMPORT QUOTES');
  console.log('══════════════════════════════════════════');

  let quotationList;
  try {
    console.log('[quotes] Fetching quotations from Teamleader...');
    quotationList = await tlList('quotations.list', token);
  } catch (err) {
    console.error('[quotes] Failed to fetch list:', err.message);
    return { inserted: 0, linesInserted: 0, errors: 0 };
  }

  console.log(`[quotes] Found ${quotationList.length} quotations.`);

  let inserted = 0;
  let linesInserted = 0;
  let errors = 0;

  // Track how many quotes we've inserted per deal so we can number multiples.
  // Key: deal_number (e.g. "D-2026-4148"), Value: count of quotes already inserted
  const quoteCountPerDeal = {};

  // Sequential fallback counter for quotes without a deal
  let orphanCounter = 1;

  for (let i = 0; i < quotationList.length; i++) {
    const q = quotationList[i];

    if (i > 0 && i % 50 === 0) {
      console.log(`[quotes] Progress: ${i}/${quotationList.length} (inserted ${inserted}, lines ${linesInserted}, errors ${errors})`);
    }

    try {
      // ── Look up deal ─────────────────────────────────────────────────────
      // TL quotation has `deal` = {type: 'deal', id: '<tlDealId>'} or null
      const tlDealId = q.deal?.id || q.deal_id || null;
      let dealId = null;
      let dealNumber = null;
      let customerId = null;

      if (tlDealId) {
        const dealRes = await pool.query(
          `SELECT id, deal_number, customer_id FROM deals WHERE external_id = $1`,
          [`tl-deal-${tlDealId}`]
        );
        if (dealRes.rows.length) {
          dealId = dealRes.rows[0].id;
          dealNumber = dealRes.rows[0].deal_number; // e.g. "D-2026-4148"
          customerId = dealRes.rows[0].customer_id;
        }
      }

      // If no deal link, try to resolve customer directly from quotation
      if (!customerId) {
        const tlCompanyId =
          q.customer?.id ||
          q.invoicee_customer_id ||
          null;
        customerId = await findCustomerId(tlCompanyId);
      }

      // ── Derive quote number ──────────────────────────────────────────────
      // First quote for a deal: Q-YYYY-NNNN
      // Second quote: Q-YYYY-NNNN-2, third: Q-YYYY-NNNN-3, etc.
      // Orphan (no deal): Q-ORPHAN-{zero-padded sequential}
      let quoteNumber;
      if (dealNumber) {
        // Replace D- prefix with Q-
        const baseQuoteNumber = dealNumber.replace(/^D-/, 'Q-');
        const prev = quoteCountPerDeal[dealNumber] || 0;
        quoteCountPerDeal[dealNumber] = prev + 1;
        quoteNumber = prev === 0 ? baseQuoteNumber : `${baseQuoteNumber}-${prev + 1}`;
      } else {
        quoteNumber = `Q-ORPHAN-${String(orphanCounter).padStart(4, '0')}`;
        orphanCounter++;
      }

      // ── Status mapping ───────────────────────────────────────────────────
      let status;
      switch (q.status) {
        case 'draft':    status = 'DRAFT';    break;
        case 'sent':     status = 'SENT';     break;
        case 'accepted': status = 'ACCEPTED'; break;
        case 'rejected': status = 'DECLINED'; break;
        case 'expired':  status = 'EXPIRED';  break;
        default:         status = 'DRAFT';    break;
      }

      // ── Dates ─────────────────────────────────────────────────────────────
      const tlCreatedAt = q.created_at ? new Date(q.created_at) : new Date();
      const createdAtIso = tlCreatedAt.toISOString();
      const quoteDateIso = tlCreatedAt.toISOString().slice(0, 10);

      // valid_until: 30 days after quote date if not provided
      const validUntil = q.valid_until || addDays(tlCreatedAt, 30);

      // ── Totals ───────────────────────────────────────────────────────────
      const subtotal = parsePrice(
        q.total?.tax_exclusive ||
        q.total_tax_exclusive_amount ||
        null
      );
      const total = parsePrice(
        q.total?.tax_inclusive ||
        q.total_tax_inclusive_amount ||
        null
      );
      const vatAmount = Math.max(0, total - subtotal);

      // ── Insert quote ─────────────────────────────────────────────────────
      const quoteId = crypto.randomUUID();
      const externalId = `tl-quotation-${q.id}`;

      await pool.query(
        `INSERT INTO quotes
          (id, quote_number, customer_id, deal_id, status,
           quote_date, valid_until, subtotal, vat_amount, total,
           created_by, external_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (external_id) DO NOTHING`,
        [
          quoteId,
          quoteNumber,
          customerId,
          dealId,
          status,
          quoteDateIso,
          validUntil,
          subtotal,
          vatAmount,
          total,
          systemUserId,
          externalId,
          createdAtIso,
          createdAtIso,
        ]
      );
      inserted++;

      // ── Fetch and insert quote lines ─────────────────────────────────────
      let quotationData;
      try {
        quotationData = await tlPost('quotations.info', { id: q.id }, token);
      } catch (lineErr) {
        console.warn(`[quotes] Could not fetch lines for quotation ${q.id}:`, lineErr.message);
        continue; // skip lines, quote header already saved
      }

      const lines = extractLines(quotationData);
      for (const line of lines) {
        try {
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
            `INSERT INTO quote_lines
              (id, quote_id, sku_snapshot, title_snapshot, qty,
               gross_unit_price, discount_percent, net_line_total,
               vat_rate, vat_amount, cost_snapshot, expected_margin_snapshot,
               created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              crypto.randomUUID(),
              quoteId,
              sku,
              description,
              qty,
              unitPrice,
              discount,
              netLineTotal,
              vatRate,
              vatLineAmount,
              0, // cost_snapshot — not available from TL
              0, // expected_margin_snapshot — not available from TL
              now,
              now,
            ]
          );
          linesInserted++;
        } catch (lineErr) {
          console.warn(`[quotes] Line insert error for quotation ${q.id}:`, lineErr.message);
          errors++;
        }
      }
    } catch (err) {
      console.warn(`[quotes] Error for quotation ${q.id}:`, err.message);
      errors++;
    }
  }

  console.log(`[quotes] Done. Inserted: ${inserted}, Lines: ${linesInserted}, Errors: ${errors}`);
  return { inserted, linesInserted, errors };
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2c — IMPORT INVOICES
// ══════════════════════════════════════════════════════════════════════════════

async function importInvoices(token, systemUserId) {
  console.log('\n══════════════════════════════════════════');
  console.log('PHASE 2c — IMPORT INVOICES');
  console.log('══════════════════════════════════════════');

  let invoiceList;
  try {
    console.log('[invoices] Fetching invoices from Teamleader...');
    invoiceList = await tlList('invoices.list', token);
  } catch (err) {
    console.error('[invoices] Failed to fetch list:', err.message);
    return { inserted: 0, linesInserted: 0, errors: 0 };
  }

  console.log(`[invoices] Found ${invoiceList.length} invoices.`);

  let inserted = 0;
  let linesInserted = 0;
  let errors = 0;

  // Regex to parse TL invoice number format "YYYY / NNN" (with optional spaces)
  const TL_INV_NUM_RE = /^(\d{4})\s*\/\s*(\d+)$/;

  for (let i = 0; i < invoiceList.length; i++) {
    const inv = invoiceList[i];

    if (i > 0 && i % 50 === 0) {
      console.log(`[invoices] Progress: ${i}/${invoiceList.length} (inserted ${inserted}, lines ${linesInserted}, errors ${errors})`);
    }

    try {
      // ── Derive invoice number ────────────────────────────────────────────
      // TL invoice_number may be:
      //   - null / empty      → draft, use DRAFT-{short_uuid}
      //   - "2026 / 211"      → parse → F-2026-0211
      //   - already "F-…"     → keep as-is (shouldn't happen, but safe fallback)
      let invoiceNumber;
      const tlInvNum = inv.invoice_number?.id || inv.invoice_number || null;
      const rawNum = tlInvNum ? String(tlInvNum).trim() : '';
      const isDraftTL = inv.status === 'draft';

      if (isDraftTL || !rawNum) {
        // Unique DRAFT identifier using 8 hex chars of a UUID
        invoiceNumber = `DRAFT-${crypto.randomUUID().slice(0, 8)}`;
      } else if (rawNum.startsWith('F-')) {
        invoiceNumber = rawNum;
      } else {
        const m = rawNum.match(TL_INV_NUM_RE);
        if (m) {
          const year = m[1];
          const seq = m[2].padStart(3, '0'); // pad to at least 3 digits
          invoiceNumber = `F-${year}-${seq}`;
        } else {
          // Unrecognised format — sanitise and prefix with F-
          invoiceNumber = `F-${rawNum.replace(/\s+/g, '-')}`;
        }
      }

      // ── Customer ─────────────────────────────────────────────────────────
      const tlCompanyId =
        inv.invoicee?.customer?.id ||
        inv.invoicee_customer_id ||
        inv.customer?.id ||
        null;
      const customerId = await findCustomerId(tlCompanyId);

      // ── Deal link ─────────────────────────────────────────────────────────
      const tlDealId = inv.deal?.id || inv.deal_id || null;
      let dealId = null;
      if (tlDealId) {
        const dealRes = await pool.query(
          `SELECT id FROM deals WHERE external_id = $1`,
          [`tl-deal-${tlDealId}`]
        );
        if (dealRes.rows.length) dealId = dealRes.rows[0].id;
      }

      // ── Status ────────────────────────────────────────────────────────────
      // TL statuses: draft | outstanding | paid | overdue | matched
      // `paid` field (boolean) is also present in some responses
      let status;
      if (inv.paid === true || inv.status === 'paid') {
        status = 'PAID';
      } else if (isDraftTL) {
        status = 'DRAFT';
      } else {
        status = 'SENT'; // outstanding / overdue / matched → SENT (most relevant local state)
      }

      // ── Dates ─────────────────────────────────────────────────────────────
      const invoiceDate = inv.invoice_date || new Date().toISOString().slice(0, 10);
      const dueDate = inv.due_on || addDays(new Date(invoiceDate), 30);

      // ── Totals ────────────────────────────────────────────────────────────
      const subtotal = parsePrice(
        inv.total?.tax_exclusive ||
        inv.total_tax_exclusive_amount ||
        null
      );
      const total = parsePrice(
        inv.total?.tax_inclusive ||
        inv.total_tax_inclusive_amount ||
        null
      );
      const vatAmount = Math.max(0, total - subtotal);

      const isPaid = status === 'PAID';
      const paidAmount = isPaid ? total : 0;
      const openAmount = isPaid ? 0 : total;

      // ── Insert invoice ────────────────────────────────────────────────────
      const invoiceId = crypto.randomUUID();
      const externalId = `tl-invoice-${inv.id}`;
      // Use invoice_date for created_at (closest thing to a real creation date)
      const createdAtIso = inv.invoice_date
        ? new Date(inv.invoice_date).toISOString()
        : new Date().toISOString();

      await pool.query(
        `INSERT INTO invoices
          (id, invoice_number, customer_id, deal_id, status,
           invoice_date, due_date, subtotal, vat_amount, total,
           open_amount, paid_amount,
           created_by, external_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (external_id) DO NOTHING`,
        [
          invoiceId,
          invoiceNumber,
          customerId,
          dealId,
          status,
          invoiceDate,
          dueDate,
          subtotal,
          vatAmount,
          total,
          openAmount,
          paidAmount,
          systemUserId,
          externalId,
          createdAtIso,
          createdAtIso,
        ]
      );
      inserted++;

      // ── Fetch and insert invoice lines ────────────────────────────────────
      let invoiceData;
      try {
        invoiceData = await tlPost('invoices.info', { id: inv.id }, token);
      } catch (lineErr) {
        console.warn(`[invoices] Could not fetch lines for invoice ${inv.id}:`, lineErr.message);
        continue; // skip lines, invoice header already saved
      }

      const lines = extractLines(invoiceData);
      for (const line of lines) {
        try {
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
              crypto.randomUUID(),
              invoiceId,
              sku,
              description,
              qty,
              unitPrice,
              discount,
              netLineTotal,
              vatRate,
              vatLineAmount,
              now,
              now,
            ]
          );
          linesInserted++;
        } catch (lineErr) {
          console.warn(`[invoices] Line insert error for invoice ${inv.id}:`, lineErr.message);
          errors++;
        }
      }
    } catch (err) {
      console.warn(`[invoices] Error for invoice ${inv.id}:`, err.message);
      errors++;
    }
  }

  console.log(`[invoices] Done. Inserted: ${inserted}, Lines: ${linesInserted}, Errors: ${errors}`);
  return { inserted, linesInserted, errors };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Distrixs CRM — Teamleader Deal/Quote/Invoice Reimport  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`API delay: ${DELAY}ms per call (~${Math.floor(60000 / DELAY)} req/min)\n`);

  // ── Auth ─────────────────────────────────────────────────────────────────
  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    console.error('[auth] FATAL:', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  let systemUserId;
  try {
    systemUserId = await getSystemUserId();
    console.log(`[auth] System user ID: ${systemUserId}`);
  } catch (err) {
    console.error('[auth] FATAL:', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  // ── Phase 1: Cleanup ─────────────────────────────────────────────────────
  try {
    await runCleanup();
  } catch (err) {
    console.error('[cleanup] FATAL — aborting to prevent partial state.');
    await pool.end().catch(() => {});
    process.exit(1);
  }

  // ── Phase 2: Reimport ─────────────────────────────────────────────────────
  let dealCounts = { inserted: 0, errors: 0 };
  let quoteCounts = { inserted: 0, linesInserted: 0, errors: 0 };
  let invoiceCounts = { inserted: 0, linesInserted: 0, errors: 0 };

  try {
    dealCounts = await importDeals(token, systemUserId);
  } catch (err) {
    console.error('[deals] Section crashed:', err.message);
  }

  try {
    quoteCounts = await importQuotes(token, systemUserId);
  } catch (err) {
    console.error('[quotes] Section crashed:', err.message);
  }

  try {
    invoiceCounts = await importInvoices(token, systemUserId);
  } catch (err) {
    console.error('[invoices] Section crashed:', err.message);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  SUMMARY                                               ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`Deals:    inserted=${dealCounts.inserted}, errors=${dealCounts.errors}`);
  console.log(`Quotes:   inserted=${quoteCounts.inserted}, lines=${quoteCounts.linesInserted}, errors=${quoteCounts.errors}`);
  console.log(`Invoices: inserted=${invoiceCounts.inserted}, lines=${invoiceCounts.linesInserted}, errors=${invoiceCounts.errors}`);
  console.log(`Finished: ${new Date().toISOString()}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('FATAL UNHANDLED ERROR:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
