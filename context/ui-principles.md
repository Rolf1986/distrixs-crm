# UI-principes – Distrixs CRM

## Uitstraling
Professionele B2B SaaS. Rustig, zakelijk, snel scanbaar.
Voelt als een volwassen product, niet als een prototype.

## Navigatiemodel
- **Vaste linker sidebar** – altijd zichtbaar, nooit verwijderen
- **Niveau A**: globale modulepagina's (deals, offertes, facturen, klanten, inkoop)
- **Niveau B**: detailpagina's met header + KPI's + tabs
- Tabs bestaan ALLEEN binnen detailcontext

## Componentregels
- Sidebar: altijd aanwezig
- DataTable: klikbare rijen, compact maar niet cramped, sticky header
- KpiCard: alleen waar functioneel nodig
- StatusBadge: kleurgebruik is functioneel (groen = akkoord/betaald, rood = verlopen/afgewezen, blauw = verzonden, grijs = concept)
- ActionBar: primaire acties rechtsboven in detailschermen
- Bulkacties: alleen zichtbaar bij actieve selectie

## Kleurconventies statussen
| Status         | Kleur  |
|----------------|--------|
| Concept/Draft  | grijs  |
| Verzonden/Sent | blauw  |
| Akkoord/Betaald| groen  |
| Afgewezen      | rood   |
| Over datum     | oranje |
| Verloren       | rood   |
| Gewonnen       | groen  |

## Globale overzichten — nooit verwijderen
- Deals overzicht
- Offertes overzicht
- Facturen overzicht
- Klanten overzicht
- Inkoop overzicht
