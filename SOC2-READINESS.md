# SOC 2 Readiness-assessment — Distrixs CRM

Datum: 2026-10-01 · Gebaseerd op: de onafhankelijke review van 2026-09-07 (REVIEW.md), de daarna uitgevoerde week-1-hardening, en live verificatie van de serverstatus op 2026-10-01.

---

## 1. Vooraf: wat dit wel en niet is

**SOC 2 is een attestatie, geen zelfverklaring.** Een SOC 2-rapport (Type I of Type II) kan uitsluitend worden afgegeven door een externe, geregistreerde auditor (CPA/RA) na een formele audit. Een Type II vereist bovendien een observatieperiode van 3–12 maanden waarin de controls aantoonbaar werken. Kosten liggen typisch tussen €15.000 en €50.000 per jaar, plus doorlopende administratieve last (policies, bewijsverzameling, jaarlijkse heraudit).

Dit document is daarom een **readiness-assessment**: het legt het CRM langs de vijf Trust Services Criteria (TSC) van SOC 2 en benoemt per criterium wat al op orde is en wat zou ontbreken bij een echte audit.

**Eerlijk advies over proportionaliteit:** SOC 2 is ontworpen voor SaaS-leveranciers waarvan zakelijke klanten een auditrapport eisen. Het Distrixs CRM is een intern systeem met één gebruiker; geen enkele klant van Distrixs gebruikt het CRM als dienst. Een formeel SOC 2-traject is in die situatie disproportioneel. Wat wél zinvol is: de gaps hieronder sluiten (grotendeels = de al geplande REVIEW-rondes 2–4) en, als een klant of partner ooit om zekerheid vraagt, een eigen beveiligingsverklaring op basis van dit document. Zie §5.

---

## 2. Scope en methode

- **Systeem:** Distrixs CRM (Next.js 16.3.4 / Prisma 7 / PostgreSQL), productie op Hetzner (46.225.76.147), domein crm.distrixs.nl.
- **Bewijs:** statische codereview (sept 2026), live geverifieerde serverconfiguratie (1 okt 2026: sshd-config, fail2ban, ufw, backup-cron, offsite-kopie), en de wijzigingshistorie van de week-1-hardening.
- **Niet beoordeeld:** organisatorische documenten (verwerkersovereenkomsten, polissen), fysieke beveiliging bij Hetzner/DigitalOcean (gedekt door hún eigen certificeringen), en de WordPress-sites (buiten scope).

---

## 3. Scorecard per Trust Services Criterium

| Criterium | Status | Kern |
|---|---|---|
| **Security** (verplicht, CC1–CC9) | 🟡 Grotendeels op orde | Techniek sterk na week-1; organisatorische controls (policies, monitoring, change management) ontbreken |
| **Availability** | 🟡 Basis op orde | Versleutelde offsite-backups + restore-test ✓; geen uptime-monitoring, schijf 83% vol, single server |
| **Confidentiality** | 🟠 Gaps | TLS/versleutelde backups ✓; API-secrets nog plaintext in DB (PRIV-01) |
| **Processing Integrity** | 🟠 Gaps | Snapshot-architectuur en Decimal-geldvelden ✓; betalings-herberekening 5× gedupliceerd, geen tests |
| **Privacy** | 🔴 Grootste afstand | Geen verwijder-/anonimiseerpad, geen bewaartermijnen, auditlog beperkt (= geplande AVG-ronde) |

---

## 4. Bevindingen per criterium

### 4.1 Security (Common Criteria — verplicht voor elk SOC 2-rapport)

**Op orde (live geverifieerd waar van toepassing):**
- Toegang: alle pagina's en 117/125 routes achter sessiecheck; bcrypt cost 12; OTP's gehasht en single-use; rate-limiting + honeypot op login.
- Server: SSH keys-only + root alleen met key (`40-hardening.conf` wint van cloud-init), fail2ban actief (5 actieve bans), ufw actief (22/80/443), unattended security-upgrades.
- Netwerk/app: TLS 1.2/1.3 + HSTS + CSP, database niet gepubliceerd, app draait non-root, SQL volledig geparametriseerd.
- Mail-XSS (SEC-01) gesanitized, Next.js op 16.3.4, next-auth verwijderd, RMA-mails ge-escaped, XFF-fix.

**Gaps voor SOC 2:**
| Gap | SOC 2-criterium | Bestaand reviewpunt |
|---|---|---|
| Geen beschreven beleid (infosec-policy, incident-response-plan, risicobeoordeling als levend document) | CC1/CC2/CC3 | nieuw — SOC 2 draait voor ~50% op documentatie |
| Geen monitoring/alerting (uptime, schijf, fouten, inbraakdetectie) | CC4/CC7 | INFRA-05 |
| Sessies 30 dagen geldig, niet intrekbaar | CC6 | SEC-04 |
| Rollenmodel bestaat maar wordt op 4/125 routes gehandhaafd | CC6 | PRIV-05 |
| Geen MFA op het CRM-login | CC6 | nieuw |
| Change management: geen CI, geen tests, geen reproduceerbare migraties, deploy via handmatige cherry-pick | CC8 | KWAL-01, KWAL-02 |
| Leveranciersbeheer: DPA's met Resend/Mollie/Twinfield/MyParcel/Hetzner niet vastgelegd | CC9 | PRIV-09 |

### 4.2 Availability

**Op orde:** dagelijkse versleutelde backup (GPG) 02:00 ✓, offsite-kopie naar gescheiden droplet via restricted key ✓ (vandaag geverifieerd: kopie van 02:00 aanwezig), retentie 30/60 dagen, gedocumenteerde restore-test uitgevoerd, certbot-auto-renew, logrotatie.

**Gaps:**
- **Schijf 83% vol** (was 75% in september) — zonder alerting loopt dit stil vol. Eerste concrete actiepunt.
- Geen uptime-/resource-monitoring (INFRA-05): een storing valt pas op als Rolf het zelf merkt.
- Geen gedefinieerde RTO/RPO; single server zonder failover (voor deze schaal acceptabel, maar een auditor wil het op papier als bewuste keuze).

### 4.3 Confidentiality

**Op orde:** TLS overal, backups versleuteld, `.env.production` 600, backup-passphrase gescheiden bewaard.

**Gaps:** Mollie-/Twinfield-/Teamleader-/MyParcel-secrets in plaintext in `company_settings` (PRIV-01 — gepland in ronde 2); `crypto.ts` gebruikt CTR zonder integriteit (SEC-09); geen dataclassificatie (welke data is vertrouwelijk en wie mag erbij — bij één gebruiker vooral een papieren exercitie).

### 4.4 Processing Integrity

**Op orde:** immutable snapshotflow offerte→factuur, atomaire nummering, `Decimal(12,2)` voor al het geld, Mollie-webhook verifieert bij de bron, Twinfield-boekingen als concept (menselijke controle vóór definitief).

**Gaps:** betalings-herberekening op 5 plekken met afwijkend gedrag (KWAL-02 — al gepland als eerste punt van ronde 2); nul geautomatiseerde tests op de financiële kernlogica; regel-btw-afronding (KWAL-13).

### 4.5 Privacy

Grootste afstand tot SOC 2 (en tegelijk: AVG-plichten die óók zonder SOC 2 gelden):
- Geen verwijder-/anonimiseerpad voor klanten en contactpersonen (PRIV-02).
- Geen bewaartermijnen of opschoning: mails, analytics, auditlogs en RMA's groeien eeuwig (PRIV-03/04/12).
- Auditlog dekt alleen betalingen/creditnota's/notities — geen logins, deletes of settings-wijzigingen (PRIV-06).
- Verwerkersovereenkomsten niet gearchiveerd; Resend = VS-verwerker, DPA/doorgiftemechanisme te bevestigen (PRIV-09).
- Geen privacyverklaring/register van verwerkingen voor het CRM zelf.

---

## 5. Advies en route

**Als het doel is "aantoonbaar veilig" (aanbevolen):**
1. **Nu:** schijfruimte CRM-server aanpakken + simpele monitoring (uptime + schijf + fail2ban-mail) — het enige acute punt uit deze assessment.
2. **Ronde 2 (al gepland):** betalings-herberekening centraliseren, DB-secrets versleutelen, migratie-baseline, FK-indexen.
3. **AVG-ronde (al gepland):** anonimiseren, bewaartermijnen, auditlog uitbreiden, sessie-intrekking. Dit sluit meteen de hele Privacy-kolom.
4. **Papier (nieuw, ~1 dag werk):** beknopte infosec-policy + incident-responseplan + leveranciersoverzicht met DPA's + RTO/RPO-besluit. Daarmee is ~90% van de SOC 2-gapanalyse gedicht op auditor-handtekening na.

**Als een klant/partner ooit formeel om SOC 2 vraagt:** eerst vragen wat ze werkelijk nodig hebben — vrijwel altijd volstaat een eigen beveiligingsverklaring (gebaseerd op dit document + REVIEW.md) of de certificeringen van de onderliggende leveranciers (Hetzner ISO 27001, Mollie PCI-DSS/DNB, Google Workspace SOC 2). Pas als er een harde contractuele eis ligt, loont een gesprek met een auditor — en dan is dit document de gap-analyse waarmee dat traject start.

---

*Dit document is een zelfbeoordeling en geen SOC 2-rapport. Er is tijdens deze assessment niets aan het systeem gewijzigd.*
