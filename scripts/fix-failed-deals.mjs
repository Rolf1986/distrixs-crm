#!/usr/bin/env node
/**
 * Distrixs CRM — Herstel ontbrekende deals
 * ==========================================
 * Importeert deals die bij de eerste reimport zijn overgeslagen omdat:
 *   1. De lead een particulier (contact zonder bedrijf) is
 *   2. Het bedrijf nieuw was en nog niet in onze DB stond
 *
 * Wat dit script doet:
 *   - Haalt alle TL deals op die NIET in onze DB staan
 *   - Voor particulieren: maakt een klantrecord aan op naam (voornaam + achternaam)
 *   - Voor bedrijven: probeert ze alsnog te koppelen (werkt na sync-customers)
 *   - Importeert de deal met correct nummer en datum
 *
 * Gebruik:
 *   DATABASE_URL=postgresql://... node scripts/fix-failed-deals.mjs
 */

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const DELAY = 650;

if (!process.env.DATABASE_URL) { console.error('ERROR: DATABASE_URL niet ingesteld'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tlPost(endpoint, body, token) {
  await sleep(DELAY);
  const res = await fetch(`https://api.focus.teamleader.eu/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`TL ${endpoint} → ${res.status}: ${t.slice(0,200)}`); }
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
  if (!res.rows.length || !res.rows[0].teamleader_access_token) throw new Error('Geen token gevonden.');
  return res.rows[0].teamleader_access_token;
}

async function getSystemUserId() {
  const res = await pool.query(`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`);
  if (!res.rows.length) throw new Error('Geen ADMIN gebruiker.');
  return res.rows[0].id;
}

/**
 * Zoek klant op via bedrijf (beide external_id formaten).
 */
async function findCustomerByCompany(tlCompanyId) {
  if (!tlCompanyId) return null;
  let res = await pool.query(`SELECT id FROM customers WHERE external_id = $1`, [`tl-company-${tlCompanyId}`]);
  if (res.rows.length) return res.rows[0].id;
  res = await pool.query(`SELECT id FROM customers WHERE external_id = $1`, [tlCompanyId]);
  if (res.rows.length) return res.rows[0].id;
  return null;
}

/**
 * Zoek klant op via contactpersoon (contact is gekoppeld aan een bedrijf).
 */
async function findCustomerByContact(tlContactId) {
  if (!tlContactId) return null;
  let res = await pool.query(
    `SELECT c.id FROM customers c
     JOIN customer_contacts cc ON cc.customer_id = c.id
     WHERE cc.external_id = $1 OR cc.external_id = $2 LIMIT 1`,
    [`tl-contact-${tlContactId}`, tlContactId]
  );
  if (res.rows.length) return res.rows[0].id;
  return null;
}

/**
 * Maakt een klantrecord aan voor een particulier (contact zonder bedrijf).
 * Geeft het nieuwe customer_id terug.
 */
async function createParticulierCustomer(tlContactId, contactData, systemUserId) {
  const firstName = contactData.first_name || '';
  const lastName = contactData.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Onbekend';
  const email = contactData.emails?.[0]?.email || null;
  const phone = contactData.telephones?.[0]?.number || null;

  // Bepaal volgend klantnummer
  const numRes = await pool.query(`
    SELECT customer_number FROM customers
    WHERE customer_number ~ '^K-[0-9]{4}-[0-9]+'
    ORDER BY CAST(split_part(customer_number, '-', 3) AS INTEGER) DESC
    LIMIT 1
  `);
  let customerNumber;
  if (!numRes.rows.length) {
    customerNumber = 'K-2026-001';
  } else {
    const last = numRes.rows[0].customer_number;
    const parts = last.split('-');
    const seq = parseInt(parts[2]) + 1;
    customerNumber = `K-${parts[1]}-${String(seq).padStart(3, '0')}`;
  }

  const customerId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Maak klant aan
  await pool.query(
    `INSERT INTO customers
      (id, customer_number, company_name, status, default_payment_term,
       external_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [customerId, customerNumber, fullName, 'ACTIVE', 30,
     `tl-contact-customer-${tlContactId}`, now, now]
  );

  // Maak ook het contact aan zodat het zichtbaar is
  await pool.query(
    `INSERT INTO customer_contacts
      (id, customer_id, first_name, last_name, email, phone,
       is_primary, is_active, external_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT DO NOTHING`,
    [crypto.randomUUID(), customerId, firstName, lastName, email, phone,
     true, true, `tl-contact-${tlContactId}`, now, now]
  );

  console.log(`  → Particulier aangemaakt: ${customerNumber} — ${fullName}`);
  return customerId;
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Distrixs CRM — Herstel ontbrekende deals    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Gestart: ${new Date().toISOString()}\n`);

  const token = await getAccessToken();
  const systemUserId = await getSystemUserId();

  // Haal alle TL deals op
  console.log('[deals] Ophalen uit Teamleader...');
  const allDeals = await tlList('deals.list', token);
  console.log(`[deals] ${allDeals.length} deals gevonden in TL`);

  // Bepaal welke al in onze DB staan
  const existingRes = await pool.query(`SELECT external_id FROM deals WHERE external_id IS NOT NULL`);
  const existingIds = new Set(existingRes.rows.map(r => r.external_id));
  console.log(`[deals] ${existingIds.size} deals al in DB`);

  const missing = allDeals.filter(d => !existingIds.has(`tl-deal-${d.id}`));
  console.log(`[deals] ${missing.length} deals nog niet in DB — verwerken...\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < missing.length; i++) {
    const d = missing[i];
    if (i > 0 && i % 20 === 0) {
      console.log(`[deals] ${i}/${missing.length} (ingevoerd: ${inserted}, skip: ${skipped}, fouten: ${errors})`);
    }

    try {
      const lead = d.lead;
      const leadCustomer = lead?.customer;
      let customerId = null;

      if (!leadCustomer) {
        console.warn(`  Deal ${d.reference}: geen lead.customer → overgeslagen`);
        skipped++;
        continue;
      }

      if (leadCustomer.type === 'company' || !leadCustomer.type) {
        // Bedrijfsdeal — zoek in customers tabel
        customerId = await findCustomerByCompany(leadCustomer.id);
        if (!customerId) {
          console.warn(`  Deal ${d.reference}: bedrijf ${leadCustomer.id} niet gevonden → overgeslagen (draai sync-customers eerst)`);
          skipped++;
          continue;
        }
      } else if (leadCustomer.type === 'contact') {
        // Particulier — zoek eerst via gekoppeld bedrijf
        customerId = await findCustomerByContact(leadCustomer.id);

        if (!customerId) {
          // Geen bedrijf gevonden → maak particulier-klant aan
          let contactData;
          try {
            contactData = await tlPost('contacts.info', { id: leadCustomer.id }, token);
          } catch {
            console.warn(`  Deal ${d.reference}: contact ${leadCustomer.id} niet opvraagbaar → overgeslagen`);
            skipped++;
            continue;
          }

          // Controleer of particulier al bestaat (vorige run)
          const existing = await pool.query(
            `SELECT id FROM customers WHERE external_id = $1`,
            [`tl-contact-customer-${leadCustomer.id}`]
          );
          if (existing.rows.length) {
            customerId = existing.rows[0].id;
          } else {
            customerId = await createParticulierCustomer(leadCustomer.id, contactData, systemUserId);
          }
        }
      }

      if (!customerId) { skipped++; continue; }

      // Bepaal dealnummer
      const tlCreatedAt = d.created_at ? new Date(d.created_at) : new Date();
      const year = tlCreatedAt.getFullYear();
      const ref = d.reference || d.id.slice(0, 8);
      const dealNumber = `D-${year}-${String(ref).padStart(4, '0')}`;

      // Status
      let status;
      switch (d.status) {
        case 'won':  status = 'WON';  break;
        case 'lost': status = 'LOST'; break;
        default:     status = 'NEW';  break;
      }

      const createdAtIso = tlCreatedAt.toISOString();
      await pool.query(
        `INSERT INTO deals
          (id, deal_number, title, customer_id, status,
           win_probability, expected_close_date, notes,
           created_by, external_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          crypto.randomUUID(), dealNumber,
          d.title || dealNumber, customerId, status,
          d.estimated_probability != null ? Math.round(parseFloat(d.estimated_probability) * 100) : null,
          d.estimated_closing_date || null, null,
          systemUserId, `tl-deal-${d.id}`, createdAtIso, createdAtIso,
        ]
      );

      console.log(`  ✓ Deal ${dealNumber} — ${d.title}`);
      inserted++;
    } catch (err) {
      console.warn(`  Deal ${d.reference ?? d.id}: fout — ${err.message}`);
      errors++;
    }
  }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  SAMENVATTING                                 ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Ingevoerd:  ${inserted}`);
  console.log(`Overgeslagen: ${skipped}`);
  console.log(`Fouten:     ${errors}`);
  console.log(`Klaar: ${new Date().toISOString()}`);

  await pool.end();
}

main().catch(async err => {
  console.error('FATAL:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
