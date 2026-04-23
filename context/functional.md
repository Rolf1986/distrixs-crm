# Functionele context – Distrixs CRM

## Kernmodel
- **Deal** is de centrale commerciële entiteit
- **Offerte** = immutable snapshot van deal op moment van aanmaken
- **Factuur** = immutable snapshot van offerte op moment van aanmaken
- Na creatie staat offerte en factuur volledig los van de bronentiteit

## Statusflows
- Deal: NEW → CONTACTED → QUOTE_SENT → WON | LOST
- Quote: DRAFT → SENT → ACCEPTED | REJECTED
- Invoice: DRAFT → SENT → PARTIALLY_PAID → PAID | OVERDUE | CREDITED
- PurchaseOrder: DRAFT → ORDERED → PARTIALLY_RECEIVED → RECEIVED → CLOSED | CANCELLED

## Nummerformaten
- Deal: D-YYYY-001
- Quote: Q-YYYY-001
- Invoice: F-YYYY-001
- PurchaseOrder: PO-YYYY-001

## Margelogica
- Expected marge: gebaseerd op base_cost_price (+ China-opslag schatting)
- Real marge: pas beschikbaar na inkoop + nacalculatie
- China-opslag: ~8% shipping + ~6% invoerrechten (configureerbaar)

## Twinfield
- Integratie wordt later geïmplementeerd
- Velden zijn gereserveerd: twinfieldSyncStatus, twinfieldLocked, twinfieldReference
- Na succesvolle sync is factuur inhoudelijk vergrendeld
- Correcties alleen via creditnota
