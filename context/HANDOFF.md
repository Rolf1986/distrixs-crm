# HANDOFF — Distrixs CRM (bijgewerkt 2026-08-11)

Startpunt voor een nieuwe Claude-sessie. Lees dit vóór je iets wijzigt.

## Status
- **LIVE in productie sinds medio juli 2026** — https://crm.distrixs.nl. Wijzigingen raken echte facturen/klanten. Voorzichtig met datamigraties; altijd eerst lezen, dan schrijven.
- Fase 1 t/m 4 gebouwd en in gebruik (shell, deal hub, documentflow, factuuradministratie incl. Twinfield + MyParcel). Fase 5 (nacalculatie) is gebouwd maar nog nauwelijks gevuld.

## Server & deploy
- Hetzner VPS `root@46.225.76.147`, app in `/opt/distrixs-crm` (Docker Compose: app + db + nginx).
- Deploy = commit lokaal op branch `claude/pensive-grothendieck-f4d8bd`, push, dan op de server **cherry-pick van de commit-hash** + `docker compose build app && docker compose up -d app`. Healthcheck: `curl http://127.0.0.1:3000/login` → 200.
- DB-toegang: `docker compose exec -T db psql -U distrixs -d distrixs_crm`.
- **Schemawijzigingen**: `prisma/schema.prisma` aanpassen + dezelfde kolom met raw `ALTER TABLE` op de server-DB zetten (er wordt géén `prisma migrate` op de server gedraaid; `prisma generate` draait in de Docker-build). Lokale `tsc` toont daardoor vaak stale-Prisma-fouten — negeren, de serverbuild is de echte typecheck.
- SSL: certbot met docker stop/start pre/post-hooks in `/etc/letsencrypt/renewal/crm.distrixs.nl.conf` (geldig tot 2026-11-01).

## Afwijkingen van CLAUDE.md (expliciete besluiten van Rolf)
- **Offertes zijn ALTIJD bewerkbaar** (override van de immutable-snapshot-regel). Facturen blijven wel immutable na verzenden.
- Factuurdatum = **boekdatum** (dag van verzenden), niet de dag van concept-aanmaak; vervaldatum schuift mee (standaard 14 dagen).
- Betaaltermijn standaard 14 dagen bij alle klanten.

## Twinfield (werkt end-to-end)
- `src/lib/twinfield.ts`. Auto-sync bij verzenden, toggle `company_settings.twinfield_auto_sync`. Concepten worden NOOIT geboekt.
- Debiteuren: live DEB-lijst, hergebruik op naam, nieuw = laagste vrije code 10000–19999, incl. adres + BTW-nummer.
- Per-regel BTW: VH/8100 (NL), ICL/8600 met `performancetype goods` + `performancecountry` + `performancevatnumber` (EU verlegd; klant-BTW-nummer verplicht), VN/8500 (overig). Geen `performancedate` bij goederen.
- Facturen t/m 336 staan al in Twinfield via Teamleader (gemarkeerd "Reeds in Twinfield").
- Twinfield-lock beschermt alleen de inhoud, niet betaalstatus/betalingen.

## MyParcel (werkt)
- `src/lib/myparcel.ts`. Auth = base64 van de kale key ZONDER ":". Europlus (carrier 11) eist `recipient.company` + signature. Multicollo alleen PostNL; andere carriers krijgen n losse zendingen. Barcode komt async (retry). Key in `company_settings.myparcel_api_key`.

## Creditnota's
- Aanmaken met regelselectie vanaf de factuur (tab Creditnota's), PDF, mailen.
- **Verrekenen**: knop "Verrekenen met factuur" (creditnota-pagina + factuur-tab) boekt een betaling met referentie `Verrekening CN-…` (method OTHER) → openstaand bedrag daalt. Ongedaan maken = die betaling verwijderen op de betalingen-tab.

## E-mail
- Resend; standaard afzender noreply@distrixs.nl, offertes gaan uit als info@distrixs.nl met reply-to. Custom aanhef mogelijk. Alles wordt gelogd (per document + centraal onder "Verzonden mail").

## Overige conventies/quirks
- Safari: geen overlay-links in tabelrijen — gebruik `src/components/RowLink.tsx`.
- Teamleader-import: mag status nooit verlagen, nummer nooit overschrijven, paidAmount alleen omhoog.
- ICL-klanten (EU + BTW-nr): 0% wordt server-side afgedwongen op offerte/factuurregels; PDF toont "BTW verlegd".
- Nummering: D/Q/F/PO-YYYY-nnn via `src/lib/sequences.ts`; klantnummers K-YYYY-nnn numeriek max+1.
- Perl-oneliners via shell breken op escaping — gebruik Edit-tool of node-scripts voor multi-file transforms.

## Openstaand (augustus 2026)
1. **Nacalculatie Q-2026-4304 / deal D-2026-4061 "Pixel Line IP"** (klant lw productions, factuur 2026/348): Rolf heeft de China-inkoopfacturen (goederen + shipping + duty). Flow: PO aanmaken onder de deal → PO-regels → `PurchaseOrderExtraCost` (SHIPPING / IMPORT_DUTIES) → nacalculatie-kaart op deal-info toont echte vs. verwachte marge. Wacht op de PDF's van Rolf.
2. Ampco Flashlight Rental: deal D-2026-4321 + offerte Q-2026-4326 staat op DRAFT (10 ACME spare-part-regels, subtotaal € 121,35) — nog te versturen.
3. ACME spare parts: prijzen geankerd op € 20,00 voor het eerste artikel, rest zelfde opslagfactor (~×3,7 op landed cost = PI-prijs ×1,32).
4. Teamleader-importknop evt. uitzetten (ooit aangeboden, nooit besloten).

## Werkwijze met Rolf
- Nederlands, praktisch, korte uitleg. Bij ambiguïteit over prijzen/varianten: **vragen, niet gokken** — en prijsafspraken vastpinnen op één concreet voorbeeldbedrag.
- Wijzigingen scopen op het genoemde deliverable, niet ongevraagd verbreden.
