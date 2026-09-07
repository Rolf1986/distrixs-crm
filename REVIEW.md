# REVIEW — Distrixs CRM (volledige onafhankelijke review)

Datum: 2026-09-07 · Reviewscope: code (repo), server (46.225.76.147 via SSH, read-only), DNS/mail (distrixs.nl). Er is in deze review niets gewijzigd.

---

## 1. Managementsamenvatting

Het systeem is functioneel gezond en beter beveiligd dan gemiddeld voor een intern gebouwde tool: alle 125 API-routes en alle pagina's zitten achter authenticatie (in productie geverifieerd), wachtwoorden zijn bcrypt-gehasht met nette login-bescherming, SQL is overal geparametriseerd, de Mollie-webhook verifieert betalingen correct, en de mailinfrastructuur (SPF/DKIM/return-path) staat goed.

**Grootste risico's, in volgorde:**
1. **Stored XSS via ontvangen e-mail** (SEC-01): elke binnenkomende mail kan JavaScript in jouw ingelogde sessie draaien.
2. **SSH staat open voor wachtwoord-brute-force** (INFRA-01): root-login + wachtwoord-login aan, ~19.000 pogingen per etmaal, geen fail2ban.
3. **Backups bestaan, maar alleen op dezelfde machine, onversleuteld en nooit restore-getest** (INFRA-02): bij een gehackte of kapotte server ben je alles kwijt — inclusief de backups.
4. **Verouderde Next.js met bekende auth-bypass-advisories** (SEC-02), terwijl de proxy de enige paginabescherming is.
5. **API-secrets (Mollie/Twinfield/Teamleader/MyParcel) in plaintext in de database** (PRIV-01) — elke DB-dump/backup bevat live betaaltoegang.

**Deze week doen:** SSH dichtzetten (keys-only, fail2ban) — 30 min; offsite backup inrichten + één restore-test; Next.js updaten; mail-HTML sanitizen. Daarna de rest volgens §6.

---

## 2. Bevindingen

Ernst: **Kritiek** = nu misbruikbaar / dataverlies mogelijk · **Hoog** = misbruikbaar met beperkte voorwaarden of geen werkende backup · **Middel** = risico bij groei/fout · **Laag** = hygiëne.

### Hoog

| ID | Locatie | Wat | Waarom het uitmaakt | Aanpak |
|---|---|---|---|---|
| SEC-01 | `src/app/api/emails/[id]/body/route.ts:22` + `src/app/(crm)/emails/EmailsPageClient.tsx:316` | HTML-body van via IMAP ontvangen mails wordt onge-sanitized gerenderd met `dangerouslySetInnerHTML`; CSP staat `unsafe-inline` toe | Iedereen die jou mailt kan JavaScript in je CRM-sessie draaien en daarmee alle API's aanroepen (data exporteren, facturen wijzigen, gebruikers aanmaken) | DOMPurify of sandbox-iframe · **S/M** |
| SEC-02 | `package.json` (`next: 16.2.4`), `src/proxy.ts` | Next-versie heeft bekende middleware/proxy-bypass-advisories (fix ≥ 16.3.4); pagina's hebben géén eigen sessiecheck — de proxy is de enige poort | Een werkende bypass geeft anoniem de inhoud van /customers, /invoices etc. | Next updaten + sessiecheck in `(crm)/layout.tsx` als tweede slot · **S+M** |
| SEC-03 | `src/app/api/rma/route.ts:160-176, 325-361` | Publiek retourformulier: alle velden gaan onge-escaped de mail-HTML in, bevestiging gaat naar een door de indiener gekozen adres; IP-rate-limit is spoofbaar (SEC-05) | Phishing-mails versturen vanaf het geverifieerde distrixs.nl-domein → reputatieschade/blacklisting | `esc()` toepassen + Turnstile/honeypot · **S** |
| INFRA-01 | server: `sshd_config` (`PermitRootLogin yes`), `50-cloud-init.conf` (`PasswordAuthentication yes`); ufw inactief; fail2ban inactief; auth.log: ~18.870 mislukte pogingen in 24u | SSH accepteert wachtwoord-logins als root en wordt actief gebruteforcet, zonder enige vertraging of blokkering | Eén geraden/gelekt wachtwoord = volledige server incl. database en backups | Keys-only + root-login uit + fail2ban; evt. ufw aan (22/80/443) · **S** |
| INFRA-02 | server: `/opt/backups` (126 dagelijkse pg_dumps, 1.6 GB), cron 02:00 | Backups staan alleen op dezelfde machine, onversleuteld, wereld-leesbaar (644), geen retentie/opschoning (schijf op 75%), en er is nooit een restore getest | Bij serververlies (hack, brand, fout) zijn productie én alle backups tegelijk weg; een gelekte dump bevat alle klantdata + plaintext API-keys (PRIV-01) | Dagelijkse versleutelde offsite-kopie (bv. Hetzner Storage Box/S3) + retentie + één gedocumenteerde restore-test · **M** |
| PRIV-01 | `prisma/schema.prisma:979,1002-1006`; `prisma/migrations/manual/`; `src/app/api/settings/payments/route.ts:17` | Mollie-key, Twinfield- en Teamleader-tokens en MyParcel-key in plaintext in `company_settings`; twee kolommen bestaan alleen buiten het Prisma-schema om (drift) | DB-dump of SQL-injectie lekt live betaal- en boekhoudtoegang (met de Mollie-key zijn refunds mogelijk); dumps verspreiden de keys mee | Versleutelen met bestaand `src/lib/crypto.ts`-mechaniek + kolommen in schema · **M** |
| PRIV-02 | geen DELETE in `src/app/api/customers/[id]/route.ts`; relaties zonder `onDelete` | AVG-verwijderverzoek is technisch onuitvoerbaar; ook geen anonimiseer-pad voor contactpersonen | Facturen moeten 7 jaar blijven, maar namen/e-mails/telefoons/notities/mails niet — nu kan er niets | "Anonimiseer klant/contact"-actie · **M** |
| PRIV-03 | hele codebase | Geen enkele bewaartermijn of opschoning: `emails` (volledige IMAP-kopieën), `sent_emails`, `analytics_events`, `audit_logs`, `rmas`, `leads` groeien eeuwig | AVG-opslagbeperking; datalek-impact groeit elke maand; analytics bouwt jarenlange klikprofielen per herleidbare klant op | Opschoon-cron + termijnen vastleggen · **M** |
| KWAL-01 | `prisma/migrations/` (3 migraties) vs `prisma/schema.prisma` (51 modellen) | 29 van 51 tabellen en veel kolommen bestaan in geen enkele migratie (handmatige ALTER's op de server) | Geen reproduceerbare weg van niets naar de productiedatabase; `migrate deploy` zou kunnen falen of resetten | Baseline-migratie via `prisma migrate diff`; daarna alleen nog migraties · **M** |
| KWAL-02 | `payments/route.ts:64-80`, `payments/[paymentId]/route.ts:36-48`, `status/route.ts:58-77`, `credit-notes/[id]/settle/route.ts:70-82`, `mollie/webhook/route.ts:99-113` | Betalings-herberekening 5× gedupliceerd met afwijkend gedrag: wel/niet afronden, drempel `<=0` vs `<=0.01`, en het Mollie-pad synct als enige de termijnen niet | Float-residu kan een volledig betaalde factuur op "deels betaald" laten hangen; Mollie-betalingen werken termijnvinkjes niet bij | Eén `recalcInvoicePaymentState()` in `src/lib/`, alle vijf plekken erop · **S** |

### Middel

| ID | Locatie | Wat | Waarom het uitmaakt | Aanpak |
|---|---|---|---|---|
| SEC-04 / PRIV-08 | `src/lib/session.ts:6,34-53`; 108 routes met kaal `getSession` | JWT 30 dagen geldig, niet intrekbaar; logout wist alleen het cookie; deactiveren van een user stopt 108 routes en alle pagina's niet | Ex-medewerker of gestolen apparaat (PWA!) houdt tot 30 dagen volledige toegang | `requireUser` overal of token-versie-check in proxy; kortere expiry · **M** |
| SEC-05 | `src/lib/rate-limit.ts:57-60` + `nginx.conf:39,52` | Rate-limit leest het eerste (client-controleerbare) element van `X-Forwarded-For` | Alle IP-limieten (login, OTP, RMA, track) omzeilbaar met een verzonnen header | nginx: XFF overschrijven met `$remote_addr` · **S** |
| SEC-06 | `src/app/api/track/route.ts:150-170` | Publiek endpoint kan e-mail/naam van bestaande WebshopAccounts overschrijven via geraden `wcId` | Datavergiftiging van het analytics-dashboard | HMAC-signing of alleen-aanvullen-als-leeg · **M** |
| SEC-07 | `npm audit`: 2 critical / 17 high | Belangrijkste: dood `next-auth`-pakket (critical, verwijderen), `next` 16.2.4 (SEC-02), `imapflow` (actief gebruikt), `nodemailer` | Bekende CVE's in de keten | next-auth eruit, next/imapflow updaten · **S/M** |
| PRIV-05 | `requireRole` in slechts 4 van 125 routes | Rollenmodel (ADMIN/SALES/FINANCE/VIEWER) bestaat maar wordt niet gehandhaafd: een VIEWER kan instellingen, API-keys en e-mailaccounts wijzigen | Least-privilege ontbreekt zodra er ooit een tweede account komt (nu: 1 admin-account) | `requireRole` op settings/users/financieel · **M** |
| PRIV-06 | `src/lib/audit.ts` + 9 call-sites | Auditlog dekt alleen betalingen/creditnota's/notities; geen logins, deletes, settings-wijzigingen; `ip`-veld wordt nooit gevuld | Bij een incident is niet te reconstrueren wie wat deed | logAudit uitbreiden · **M** |
| PRIV-07 | `src/app/api/teamleader/import/route.ts:357,421,651`; docker-compose zonder log-rotatie | Volledige klantrecords als JSON naar Docker-stdout; logs groeien onbegrensd | Persoonsdata onbeheerd in `docker logs`, buiten elk bewaarbeleid | Debug-logs weg + `max-size` log-driver · **S** |
| PRIV-09 | `src/lib/email.ts` → api.resend.com | Alle klantmail (incl. factuur-PDF's) via Resend (VS-verwerker); DNS toont wel EU-regio voor verzending (send.distrixs.nl → eu-west-1) | Doorgifte vereist DPA + doorgiftemechanisme — organisatorisch te regelen | DPA/DPF controleren · **S** |
| KWAL-03 | `TERM_DAYS` op 5 plekken; `src/lib/pdf-data.ts:10-14` mist INSTALLMENTS en heeft fallback 30 i.p.v. 14 | Betaaltermijn-tabellen lopen al uit elkaar: PDF kan andere termijn tonen dan de opgeslagen vervaldatum | Verwarring bij klant | Eén export in `src/lib/` · **S** |
| KWAL-04 | `prisma/schema.prisma` — vrijwel alle FK's zonder `@@index` (Invoice.customerId/dealId, Payment.invoiceId, QuoteLine.quoteId, …) | Postgres indexeert FK's niet automatisch; veel queries zijn seq-scans | Merkbaar traag zodra volumes groeien (analytics-tabellen groeien al) | Batch `@@index` + migratie · **S** |
| KWAL-05 | overzichten: `invoices/page.tsx:8-24`, `customers/page.tsx:7`, `products/page.tsx:6-14`, `deals/page.tsx`, `quotes/page.tsx` | Alles wordt zonder `take`/paginatie geladen en client-side gefilterd | Traag bij groei; grote payloads | Server-side paginatie of `take` · **M** |
| KWAL-06 | `quotes/[id]/pdf/route.ts:21-60`, `quotes/[id]/pdf/page.tsx`, `order-confirmations/[id]/pdf/route.ts`, `delivery-notes/[id]/pdf/route.ts` | Vier plekken bouwen elk hun eigen PDF-data naast `src/lib/pdf-data.ts` (dit beet al eens: termijnen ontbraken op de download-PDF) | Kopieën lopen uit elkaar; fixes belanden op één van de vier plekken | Alles via `pdf-data.ts` · **M** |
| KWAL-07 | `src/generated/prisma/` (verouderd, in git) | Lokale `tsc` geeft ~60 valse fouten op precies de nieuwste code; typesysteem staat daar effectief uit | Echte typefouten blijven onzichtbaar tot de serverbuild | `prisma generate` verversen of uit git + genereren bij build · **S** |
| KWAL-08 | `src/lib/` — 0× AbortController; `email.ts:58` | Geen timeouts op externe calls (Twinfield/MyParcel/Resend/Teamleader); geen retry op mail | Hangende externe API blokkeert het request; mislukte mail verdwijnt stil | fetch-wrapper met `AbortSignal.timeout` · **S** |
| MAIL-01 | DNS `_dmarc.distrixs.nl` = `v=DMARC1; p=none;` | DMARC afgedwongen noch gerapporteerd (geen `rua`) | Spoofing van @distrixs.nl wordt niet geblokkeerd en je ziet het ook niet | `rua=` toevoegen, na 2-4 weken naar `p=quarantine` · **S** |
| MAIL-02 | geen Resend-webhook-route in de code | Bounces/complaints worden niet verwerkt; app blijft naar dode adressen mailen | Sloopt langzaam de verzendreputatie; jij ziet niet dat een factuur niet aankwam | Resend-webhook → status bij InvoiceEmail/SentEmail tonen · **M** |

### Laag

| ID | Locatie | Wat | Aanpak |
|---|---|---|---|
| SEC-08 | 4 PDF-routes met `detail: String(err)` | Interne foutdetails naar (ingelogde) client | alleen loggen · S |
| SEC-09 / PRIV-10 | `src/lib/crypto.ts:9,33-35` | AES-256-CTR zonder integriteit; legacy plaintext stil geaccepteerd | naar GCM + migratie · S/M |
| SEC-10 | `src/lib/rate-limit.ts` | In-memory limiter reset bij elke deploy | pas relevant bij schaal · M |
| PRIV-04 | `SentEmail` zonder customerId-FK; mail-bodies permanent | Mailarchief niet per klant vindbaar/opschoonbaar | meenemen in PRIV-03 · S |
| PRIV-11 | `AuditLog.ip`, `User.lastLoginAt`, `Session`-/`VerificationToken`-modellen | Dode velden/tabellen | opruimen · S |
| PRIV-12 | `api/rma/route.ts` | RMA-inzendingen vallen buiten elk verwijderpad | meenemen in PRIV-02/03 · S |
| KWAL-09 | o.a. `create-label/route.ts:77,97`, `shipments/[id]/refresh:51` | `.catch(() => {})` verbergt echte verzendfouten | loggen + statusveld · S |
| KWAL-10 | `CLAUDE.md` | Zegt nog "Twinfield = placeholder" en nummerformaat `F-YYYY-001`; werkelijkheid is anders | docs bijwerken · S |
| KWAL-11 | `src/lib/snapshot.ts` (0 imports); deps `date-fns`, `next-auth`, 9× `@radix-ui/*`; dubbele `EU_COUNTRIES` (vat.ts:2 + twinfield.ts:19) | Dead code / ongebruikte dependencies | opschonen · S |
| KWAL-12 | `eslint.config.mjs` | Ignoret `src/generated/` niet → lint onbruikbaar traag | ignore toevoegen · S |
| KWAL-13 | `src/lib/recalc.ts:23-25` | Regel-btw niet afgerond vóór opslag → PDF kan een cent afwijken van totaal | afronden op centen · S |
| INFRA-03 | server-crontab | Cron-secret van recurring-invoices staat hardcoded in de crontab (waarde zichtbaar voor iedereen met server-toegang); de firmware-crons lezen hem wél netjes uit `.env.production` | zelfde patroon gebruiken · S |
| INFRA-04 | server | `.env.production` is 644 (wereld-leesbaar op de host); 40 upgradebare pakketten (o.a. Docker-reeks — valt buiten unattended-upgrades); schijf 75% vol | chmod 600; docker-pakketten meenemen in onderhoudsmoment · S |
| INFRA-05 | server | Geen monitoring/alerting (uptime, schijf, fouten) en geen logrotatie op `/var/log/crm-recurring.log`/`firmware-sync.log` | simpele uptime-monitor + logrotate · S |
| MAIL-03 | DNS `resend._domainkey` | DKIM-sleutel is 1024-bit (aanbevolen: 2048) | nieuwe key via Resend · S |
| MAIL-04 | DNS: `s1/s2._domainkey` → `u621505.wl006.sendgrid.net`; SPF bevat `ip4:185.220.174.41` + `include:_spf.google.com` | SendGrid-DKIM-records en een los IP in SPF — wordt dat nog gebruikt? Ongebruikte records zijn onnodig aanvalsoppervlak (en SPF-lookups) | controleren en opruimen wat dood is · S |

---

## 3. Quick wins (elk < 1 uur)

1. **SSH dichtzetten** (INFRA-01): `PermitRootLogin prohibit-password`, `PasswordAuthentication no` (key staat al op de server, eerst testen in tweede sessie!), `apt install fail2ban`.
2. **next-auth verwijderen** uit package.json + dode `api/auth/[...nextauth]`-route (SEC-07, critical advisory weg).
3. **Next.js → 16.3.4** (SEC-02): versie-bump + serverbuild.
4. **XFF-fix in nginx** (SEC-05): `proxy_set_header X-Forwarded-For $remote_addr;`.
5. **`esc()` toepassen in de RMA-mails** (SEC-03).
6. **DMARC `rua=mailto:…` toevoegen** (MAIL-01).
7. **Teamleader-debug-logs verwijderen** + `max-size: "10m"` log-driver in docker-compose (PRIV-07).
8. **`chmod 600 /opt/distrixs-crm/.env.production`** + cron-secret uit crontab naar env (INFRA-03/04).
9. **`src/generated/**` in eslint-ignore** (KWAL-12) en `prisma generate` lokaal verversen (KWAL-07).
10. **Backup-retentie**: `find /opt/backups -mtime +30 -delete` in de backup-cron (deel van INFRA-02; de offsite-kopie zelf is groter werk).
11. **`detail: String(err)` uit de 4 PDF-routes** (SEC-08).
12. **TERM_DAYS naar één plek** (KWAL-03).

## 4. Niet kunnen controleren

- Sterkte/aanwezigheid van `AUTH_SECRET`, `ENCRYPTION_KEY`, `TURNSTILE_SECRET_KEY` in `.env.production` (bewust niet geopend; alleen bestandsrechten bekeken).
- Verwerkersovereenkomsten (Resend/Mollie/Twinfield/MyParcel/Teamleader/Hetzner) en de Resend-DPA — organisatorisch, niet uit code af te leiden.
- Domeinregistratie distrixs.nl: verlengdatum, auto-renew, transfer-lock, geregistreerde eigenaar → registrar-paneel nodig.
- Of consent op distrixs.nl daadwerkelijk vóór het laden van track.js wordt afgedwongen (leeft in WordPress).
- Of de SendGrid-records (MAIL-04) en het losse SPF-IP nog actief gebruikt worden → mailoverzicht van je website-formulieren nodig.
- Query-performance op echte datavolumes (index-/paginatiebevindingen zijn statisch beredeneerd).
- Exploit-tests op de Next-advisories zijn niet uitgevoerd (alleen versie-matching); paginabescherming zelf is wél live geverifieerd (alle pagina's → 307 /login).

## 5. Wat goed is (niet aanraken)

- **Auth-opzet**: alle pagina's en 117/125 routes achter sessiecheck (live geverifieerd); de 8 publieke zijn bewust publiek en waar nodig rate-limited; bcrypt cost 12 met timing-safe dummy-compare; OTP's gehasht en single-use; honeypot + tijd-val + optionele Turnstile op login.
- **SQL**: alle raw queries zijn Prisma tagged templates; nul string-concatenatie; geen exec/child_process; geen file-upload-oppervlak.
- **Mollie-webhook**: verifieert de betaling bij Mollie zelf, idempotent — correct patroon.
- **Snapshot-architectuur**: offerte→factuur immutable, deal-delete beschermt facturen/PO's, atomaire nummering met race-afhandeling (`src/lib/sequences.ts`).
- **Geld**: overal `Decimal(12,2)` NOT NULL.
- **Infra-basis**: alleen 22/80/443 open, database niet gepubliceerd, app draait als non-root (`nextjs`), TLS 1.2/1.3 + HSTS + volwaardige CSP/security-headers, certbot-auto-renew met werkende hooks, unattended security-upgrades aan.
- **Mail-DNS**: SPF met `-all`, eigen return-path `send.distrixs.nl` (EU-regio), DKIM actief, MX via Google, server-IP niet op blacklists.
- **Kernlogica netjes in `src/lib`** (vat, recalc, installments, sequences, pdf-data, margin, pricing) — de duplicatie zit in de randen.

## 6. Voorgestelde volgorde van aanpak

1. **Week 1 — de vier acute punten**: SSH hardening (INFRA-01) → offsite backup + restore-test (INFRA-02) → Next-update + next-auth eruit (SEC-02/07) → mail-XSS sanitizen (SEC-01). Plus de overige quick wins uit §3 in één onderhoudsronde.
2. **Week 2-3 — geld & data**: betalings-herberekening centraliseren (KWAL-02), secrets in DB versleutelen (PRIV-01), migratie-baseline (KWAL-01), FK-indexen (KWAL-04).
3. **Daarna — AVG-ronde**: anonimiseer-actie (PRIV-02), bewaartermijn-cron (PRIV-03/04/12), auditlog uitbreiden (PRIV-06), sessie-intrekking (SEC-04).
4. **Doorlopend**: bounce-webhook (MAIL-02), PDF-databouw samentrekken (KWAL-06), paginatie (KWAL-05), en de eerste unit-tests op de top-5 van de testprioriteitenlijst (betalings-herberekening, vat.ts, recalc.ts, installments.ts, Twinfield-XML).

Er is niets gebouwd of gefixt; alles hierboven wacht op akkoord.
