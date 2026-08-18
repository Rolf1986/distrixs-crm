# Firmware-notificaties (ACME)

Onze leverancier publiceert firmware op <https://en.acmelighting.com/support?id=172> zonder
API, RSS of mailmelding. Deze module haalt die pagina dagelijks op, herkent nieuwe
versies en mailt de klanten die daarvoor zijn aangevinkt.

## Hoe het werkt

1. **Scraper** (`src/lib/acmeFirmware.ts`) leest de HTML-tabel. Per regel: productnaam,
   modelaanduiding, versie, buildcode, datum, release notes en de download-URL.
   De pagina telt ±102 pagina's / ±1.000 releases, terug tot 2015.
2. **Sync** (`src/lib/firmwareSync.ts`) schrijft dat weg en bepaalt wat nieuw is.
3. **Notificatie**: elke ACTIVE registratie voor dat product krijgt automatisch een mail
   (`src/lib/firmwareEmail.ts`) met versienummer, de release notes van de fabrikant en
   de downloadlink.

Daarnaast gaat er bij het **aanvinken** eenmalig een mail uit met de nieuwste versie die
op dat moment bekend is (`sendCurrentFirmware`), zodat de klant meteen iets aan de
registratie heeft. Die verzending wordt als notificatie gelogd, dus de dagelijkse sync
mailt diezelfde versie later niet nog eens. De leeftijdsgrens van 90 dagen geldt hier
bewust niet: dit is geen "er is nieuws"-melding maar "dit is de versie die nu klaarstaat".

Alle klantmails volgen de huisstijl uit `src/components/pdf/PdfLayout.tsx` — logo op wit,
oranje accent `#ff6600`, blauwe kop `#0170B9`, donkere merkbalk. Opbouw met tabellen en
inline stijlen, want Outlook negeert padding op een gewone link.

## Wie krijgt mail

Registraties worden in het CRM aangevinkt — de klant hoeft niets te bevestigen.

| Bron | Status bij aanmaken | Waar |
|---|---|---|
| `MANUAL` — handmatig aangevinkt | `ACTIVE` | klantkaart → tabblad Firmware |
| `INVOICE` — voorstel uit factuurhistorie, door ons bevestigd | `ACTIVE` | klantkaart → tabblad Firmware |
| `SELF` — klant meldt zich zelf aan | `PENDING` | `/firmware-updates`, daarna goedkeuren in het CRM |

`UNSUBSCRIBED` ontstaat als de klant op de afmeldlink in de mail klikt. Die keuze wordt
gerespecteerd: opnieuw aanvinken vanuit het CRM slaat zo'n adres over.

## Twee remmen tegen een mailstorm

- **Nulmeting**: de eerste sync draait als *baseline*. Alles wat er dan al staat krijgt
  `is_baseline = true` en `notified_at`, en levert dus nooit een mail op. Bij een lege
  database wordt dit automatisch afgedwongen, ongeacht wat de aanroeper meegeeft.
- **Leeftijdsgrens**: releases ouder dan 90 dagen (`MAX_NOTIFY_AGE_DAYS`) worden nooit
  gemaild — ook niet als de leverancier een oud bestand opnieuw publiceert of van URL
  verandert.

Daarnaast voorkomt de unieke sleutel op `(release_id, registration_id)` dat dezelfde
klant twee keer bericht krijgt over dezelfde release.

## Koppeling met onze artikelen

`product_firmware_links` verbindt een CRM-artikel (SKU) met een ACME-firmwareproduct.
Die koppeling is alleen nodig om uit de factuurhistorie te kunnen afleiden welke klant
welk armatuur heeft. Op `/firmware/producten` staat een knop die koppelingen voorstelt
op naamgelijkenis; voorstellen zijn oranje tot ze bevestigd zijn.

## Hoe de koppeling en de voorstellen matchen

`product_firmware_links` wordt gevuld door "Koppelingen voorstellen" op
`/firmware/producten`. Genormaliseerde sleutels (naam en model van het ACME-product)
worden gezocht in artikelnaam + SKU; de langste treffer wint. Drie regels, alle drie
op productiedata afgestemd:

- **Sleutels van alleen cijfers tellen niet mee.** "1000" komt ook voor in
  "Extension 1000cm" en midden in artikelnummers, en koppelde 24 willekeurige
  artikelen aan LP-F2000.
- **Reserveonderdelen en toebehoren doen niet mee** (`isSparePart`): SKU begint met
  "P-", of de titel bevat een onderdeelwoord. Tekst tussen haakjes telt niet mee,
  anders sneuvelt "Blinder Set (2x controller, 8x2 cable)". "washer" staat er bewust
  niet in — dat zou "LED WASHER 18X10W" uitsluiten. Aan TORNADO hingen hierdoor
  eerst 20 artikelen, waarvan 17 O-ringen en covers; nu 3.
- **Een woordgrens-regel is overwogen en verworpen**: die schrapte terechte treffers
  als TS-300M (Theatre Spot 300) en TB-1060INT (Super Dotline).

Stand: 647 koppelingen over 173 ACME-producten.

De voorstellen op de klantkaart komen uit de factuurhistorie, met twee terugvallen
die in deze datasets onmisbaar bleken:

- **Contactpersoon**: facturen uit de Teamleader-import hebben er vrijwel nooit één
  (3 van de 238 regels). Er wordt teruggevallen op een actieve contactpersoon van de
  klant zelf. 79 van de 96 klanten hebben die; de rest heeft geen mailadres en blijft
  terecht buiten beeld.
- **Regeltekst**: 7.677 van de 8.140 factuurregels hebben geen `product_id` en 1.000
  geen SKU. Regels zonder harde koppeling worden daarom op hun titel gematcht
  ("TB-5 2/FC: TORNADO IP 2 in a double Flight Case"), alleen op sleutels uit reeds
  gekoppelde artikelen. Dat brengt het aantal klanten met voorstellen van 95 naar 103.

## Pagina's

| Pad | Wat |
|---|---|
| `/firmware` | releases, sync-status en de knop "nu controleren" |
| `/firmware/producten` | ACME-producten + koppeling aan onze artikelen |
| `/firmware/registraties` | alle registraties, filterbaar; zelfaanmeldingen goedkeuren |
| `/customers/[id]/firmware` | per klant aanvinken + voorstellen uit factuurhistorie |
| `/firmware-updates` | publieke aanmeldpagina (geen login) |
| `/firmware-updates/afmelden?token=…` | afmeldlink uit de mail |

## Instellingen (.env)

```
FIRMWARE_CRON_SECRET="…"          # header x-cron-secret voor de dagelijkse cron
FIRMWARE_ALERT_EMAIL="rolf@distrixs.nl"   # interne samenvatting; leeg = geen interne mail
NEXT_PUBLIC_BASE_URL="https://crm.distrixs.nl"  # basis voor de afmeldlinks
```

## Eerste ingebruikname

1. Migratie draaien: `psql "$DATABASE_URL" -f prisma/migrations/manual/firmware_notifications.sql`
2. Nulmeting: op `/firmware` de knop **Volledige geschiedenis ophalen** (±1 minuut).
   Hierover gaat géén mail.
3. Op `/firmware/producten` koppelingen laten voorstellen en bevestigen.
4. Per klant aanvinken wie meldingen krijgt.

## Bewaking

Een scraper die stilletjes niets meer vindt is het gevaarlijkste scenario: het lijkt dan
alsof er geen nieuwe firmware is. Twee signalen, beide **uitsluitend** naar
`FIRMWARE_ALERT_EMAIL` — nooit naar klanten:

- **Direct alarm**: loopt `syncFirmware` vast, dan gaat er meteen een mail uit met de
  foutmelding en het tijdstip van de laatste geslaagde controle.
- **Waakhond**: `POST /api/firmware/watchdog` kijkt hoe oud de laatste geslaagde controle
  is (grens standaard 30 uur, aanpasbaar met `?hours=`) en meldt ook een mislukte of nooit
  afgeronde run. Als tweede cron een paar uur ná de sync vangt dit ook een cron die
  helemaal niet meer draait.

Wat dit niet vangt: een server die volledig plat ligt — dan draait de bewaking zelf ook
niet. Zodra de server terug is, meldt hij het alsnog. Een klantmail die Resend weigert
komt als `FAILED` met foutmelding in `firmware_notifications` te staan, maar levert
(nog) geen alarmmail op.

Bewust laten afgaan om te controleren dat de mail aankomt:

```
curl -X POST -H "x-cron-secret: $FIRMWARE_CRON_SECRET" \
  "https://crm.distrixs.nl/api/firmware/watchdog?hours=0"
```

## Dagelijkse cron

Op de CRM-server (Hetzner, `root@46.225.76.147`, `/opt/distrixs-crm`) staat in de crontab
van root. Het geheim wordt uit `.env.production` gelezen, zodat het maar op één plek staat:

```
15 7 * * * SECRET=$(grep -m1 "^FIRMWARE_CRON_SECRET=" /opt/distrixs-crm/.env.production | cut -d\" -f2); curl -fsS -X POST -H "x-cron-secret: $SECRET" https://crm.distrixs.nl/api/firmware/sync >> /var/log/firmware-sync.log 2>&1
0 10 * * * SECRET=$(grep -m1 "^FIRMWARE_CRON_SECRET=" /opt/distrixs-crm/.env.production | cut -d\" -f2); curl -fsS -X POST -H "x-cron-secret: $SECRET" https://crm.distrixs.nl/api/firmware/watchdog >> /var/log/firmware-sync.log 2>&1
```

Handmatig vanaf de commandline kan ook:

```
TS_NODE_PROJECT=scripts/tsconfig.script.json npx ts-node -r tsconfig-paths/register \
  scripts/firmware-sync.ts --pages=3 --dry
```

## Aandachtspunten

- De release notes zijn Engels; die nemen we onbewerkt over in de mail, met bronvermelding.
- De .zip-bestanden staan publiek op de ACME-server en zijn direct downloadbaar. We linken
  er rechtstreeks naartoe; verdwijnt zo'n bestand ooit, dan is een eigen kopie de volgende stap.
- ACME heeft nog twee andere secties (`?id=174` en `?id=175`, Library / Document Guide) met
  dezelfde HTML-structuur. Die kunnen later met dezelfde parser worden meegenomen.

## Stand per 17 augustus 2026

Live op de CRM-server. Nulmeting gedraaid: 102 pagina's, **1.011 releases**, **238
producten**, nul mails verstuurd. Sync via de cron getest (`ok:true`), publieke pagina
bereikbaar, sync-endpoint zonder geheim geeft 401. Nog te doen: artikelen koppelen op
`/firmware/producten` en de eerste klanten aanvinken.
