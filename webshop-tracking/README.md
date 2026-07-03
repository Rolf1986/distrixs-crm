# Distrixs webshop-analytics — Fase A (collectie)

First-party gedrags-tracking voor distrixs.nl (WooCommerce). De data wordt op de
webshop verzameld en in de CRM (Postgres) opgeslagen. Externe tools zijn niet nodig.

## Onderdelen

| Bestand | Waar hoort het | Doel |
|---|---|---|
| `../public/track.js` | CRM (wordt geserveerd op `…/track.js`) | Verzamelt events, respecteert consent |
| `../src/app/api/track/route.ts` | CRM | Ontvangt events, schrijft naar Postgres |
| `distrixs-analytics.php` | Webshop → `wp-content/mu-plugins/` | Laadt track.js + injecteert klant/product-context |
| Prisma-modellen | `../prisma/schema.prisma` | `WebshopAccount`, `AnalyticsVisitor/Session/Event` |

## Hoe het werkt

1. Elke bezoeker krijgt een first-party id (`dx_vid`) in de **localStorage van de
   webshop** — geen cross-domain cookies, dus geen SameSite-gedoe.
2. `track.js` stuurt events (pageview, product_view, add_to_cart, login, search)
   naar `POST /api/track` op de CRM.
3. De mu-plugin injecteert voor **ingelogde klanten** `window.dxUser` (WooCommerce
   user-ID). De CRM koppelt die `vid` aan een `WebshopAccount` — vanaf dat moment
   weet je precies wie de bezoeker is, inclusief wat hij vóór het inloggen deed.
4. Koppeling naar een CRM-`Customer`/`Contact` is **optioneel en handmatig te
   bevestigen** (komt in Fase C) — e-mailadressen kunnen immers verschillen.

## Consent (AVG)

`track.js` verstuurt **niets** tot de bezoeker toestemming geeft in *GDPR Cookie
Compliance* (cookie `moove_gdpr_popup`). De categorie staat op `thirdparty`
(`DX_CONSENT_CATEGORY` in de plugin + `consentCategory` in dxConfig).

> ⚠️ **Controleer onder welke categorie jij "statistiek/analytics" hebt gezet** in
> de GDPR-plugin. Staat het onder "Advanced Cookies", zet dan beide op `advanced`.

Neem het volgen van ingelogde klanten op naam ook op in je privacyverklaring
(grondslag: uitvoering klantrelatie / gerechtvaardigd belang).

## Installatie

### 1. CRM — database migreren
De Prisma-modellen staan al in `prisma/schema.prisma`. Draai de migratie tegen de
juiste database (kies bewust dev/productie):

```bash
npx prisma migrate dev --name webshop_analytics   # dev
# of op productie:  npx prisma migrate deploy
npx prisma generate
```

### 2. CRM — environment
Voeg toe aan de CRM-omgeving (voor CORS):

```
WEBSHOP_ORIGIN=https://www.distrixs.nl
```

Zorg dat de CRM publiek bereikbaar is vanaf de webshop en dat `…/track.js` laadt.

### 3. Webshop — mu-plugin
1. Zet in `distrixs-analytics.php` de constante `DX_CRM_BASE` op je CRM-URL
   (zonder trailing slash), bijv. `https://crm.distrixs.nl`.
2. Upload het bestand naar `wp-content/mu-plugins/` (map desnoods aanmaken).
   Must-use plugins activeren automatisch.

### 4. Verifiëren
- Open distrixs.nl, **geef consent**, en check in de CRM-DB of er rijen in
  `analytics_events` verschijnen.
- Log in als klant → er hoort een `WebshopAccount` + een `login`-event te komen.

## Volgende fasen
- **Fase B** — dashboard: bezoekers/sessies per dag met campagne-markers + UTM-uitsplitsing.
- **Fase C** — per-klant tijdlijn + handmatige CRM-koppeling.
- **Fase D** — funnels, terugkerend gedrag, top-producten, piek-detectie.
