# Technische context – Distrixs CRM

## Stack
- **Framework**: Next.js 14 (App Router)
- **Taal**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui componenten
- **ORM**: Prisma (client-js)
- **Database**: PostgreSQL
- **Icons**: lucide-react

## Mapstructuur
```
src/
  app/(crm)/        – CRM route group met gedeelde layout
    dashboard/
    deals/
    quotes/
    invoices/
    customers/
    purchase-orders/
    activities/
    files/
    settings/
  components/
    ui/             – Basis UI-componenten (shadcn-stijl)
  lib/
    prisma.ts       – Prisma client singleton
    utils.ts        – cn(), formatCurrency(), formatDate()
    pricing.ts      – Staffelprijs resolutie
    margin.ts       – Expected/real marge berekening
    snapshot.ts     – Nummergeneratie (deal/quote/invoice/po)
    twinfield.ts    – Placeholder voor Twinfield integratie
  generated/
    prisma/         – Gegenereerde Prisma client (gitignored)

prisma/
  schema.prisma     – Volledig datamodel (20 entiteiten)
  migrations/       – DB migraties

context/            – Projectcontext voor Claude Code
```

## Prisma client import
```ts
import { prisma } from "@/lib/prisma";
```

## Decimalen
Alle geldbedragen: `Decimal` type in Prisma, `@db.Decimal(12, 2)`.
Gebruik `Number(field)` voor berekeningen in TypeScript.

## Twinfield – gereserveerd
`src/lib/twinfield.ts` bevat alleen een placeholder.
Niet implementeren totdat het systeem volledig gereed is.
