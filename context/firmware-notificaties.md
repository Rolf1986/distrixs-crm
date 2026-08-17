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

## Dagelijkse cron (droplet)

```
15 7 * * * curl -fsS -X POST -H "x-cron-secret: $FIRMWARE_CRON_SECRET" \
  https://crm.distrixs.nl/api/firmware/sync >> /var/log/firmware-sync.log 2>&1
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
