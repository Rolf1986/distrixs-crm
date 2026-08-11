@AGENTS.md

# Distrixs CRM – CLAUDE.md

## Project
CRM/ERP-light voor Distrixs. Deal-centered architectuur met snapshotflow.

## Stack
- Next.js 14 (App Router) · TypeScript · Tailwind CSS
- Prisma 7 + `@prisma/adapter-pg` + PostgreSQL
- lucide-react voor icons
- shadcn/ui component-stijl (handmatig in `src/components/ui/`)

## Absolute regels
1. Sidebar blijft altijd aanwezig
2. Globale overzichten (Deals, Offertes, Facturen, Klanten, Inkoop) nooit verwijderen of vervangen door deal-tabs
3. Offerte = immutable snapshot van deal (na aanmaken los van deal)
4. Factuur = immutable snapshot van offerte (na aanmaken los van offerte)
5. Twinfield (`src/lib/twinfield.ts`) is placeholder – NIET implementeren totdat systeem gereed is

## Bouwfasen
- Fase 1: Shell (sidebar, layout, lege pagina's) ← nu bezig
- Fase 2: Deal hub (detail, tabs, dealregels, KPI's)
- Fase 3: Documentflow (snapshot deal→offerte→factuur, statusflows, PDF)
- Fase 4: Factuuradministratie (betalingen, reminders, Twinfield-lock)
- Fase 5: Inkoop & nacalculatie (PO, China extra costs, expected vs real marge)

## Nieuwe sessie? Lees eerst `context/HANDOFF.md`
Actuele status, deploy-werkwijze, afwijkende besluiten (o.a. offertes altijd bewerkbaar) en openstaande taken. Het systeem is LIVE in productie.

## Bestanden
- `prisma/schema.prisma` – volledig datamodel (20 entiteiten)
- `src/lib/prisma.ts` – Prisma client singleton (PrismaPg adapter)
- `src/lib/pricing.ts` – staffelprijs resolutie
- `src/lib/margin.ts` – expected/real marge berekening (China: +8% shipping, +6% invoerrechten)
- `src/lib/snapshot.ts` – nummerformattering (D/Q/F/PO-YYYY-001)
- `src/lib/twinfield.ts` – placeholder, gooit error als aangeroepen
- `context/` – functionele, technische en UI context

## Nummerformaten
- Deal: `D-YYYY-001` · Quote: `Q-YYYY-001` · Invoice: `F-YYYY-001` · PO: `PO-YYYY-001`

## Prisma client
```ts
import { prisma } from "@/lib/prisma";
```
Migraties: `npx prisma migrate dev`

## UI-kleurconventies
grijs = concept · blauw = verzonden · groen = akkoord/betaald · rood = afgewezen/verloren · oranje = over datum
