/**
 * Gedeelde PDF layout helpers voor alle Distrixs documenten.
 * Nabootst de lay-out van de Teamleader-documenten:
 *  - Logo links boven, bedrijfsadres rechts boven
 *  - Klantadres links
 *  - Tabel met regels
 *  - Totalen rechtsonder
 *  - Footer met KvK/BTW/IBAN
 *  - Pagina 2+ = algemene voorwaarden
 */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";

export { Document, Page, Text, View, Image, Link };

// ── Kleurpalet ──────────────────────────────────────────────────────────────
export const C = {
  blue:    "#0170B9",
  orange:  "#ff6600",
  dark:    "#2a2a2a",
  text:    "#333333",
  muted:   "#666666",
  light:   "#999999",
  border:  "#e0e0e0",
  tableHd: "#f5f5f5",
  white:   "#ffffff",
  black:   "#000000",
};

// ── Gedeelde stijlen ────────────────────────────────────────────────────────
export const shared = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.text,
    paddingTop: 48,
    paddingBottom: 50,
    paddingHorizontal: 48,
  },
  // Header: logo links, adres rechts
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 36,
  },
  logo: {
    width: 150,
    height: 64,
    objectFit: "contain",
  },
  logoText: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.blue,
  },
  companyAddrBlock: {
    textAlign: "right",
    fontSize: 8,
    color: C.muted,
    lineHeight: 1.6,
  },
  // Klantadres
  customerBlock: {
    marginBottom: 28,
    fontSize: 9,
    lineHeight: 1.6,
    color: C.text,
  },
  // Sectietitel (bijv. "Leveringsadres:")
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 2,
    color: C.dark,
  },
  // Document titel (bijv. "Offerte 2026 / 4143: Projectnaam")
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: C.orange,
    marginBottom: 6,
  },
  // Meta tabel (Nummer / Datum / etc.)
  metaRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 40,
  },
  metaLabel: {
    fontSize: 8,
    color: C.muted,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
    color: C.text,
  },
  // Tabel
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.tableHd,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: C.orange,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    backgroundColor: "#fafafa",
  },
  thText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: C.dark,
  },
  // Totalen
  totalsBox: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: "45%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  totalsLabel: { color: C.muted, fontSize: 8.5 },
  totalsValue: { fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  totalFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: C.orange,
    marginTop: 3,
    borderRadius: 2,
  },
  totalFinalLabel: { color: C.white, fontFamily: "Helvetica-Bold", fontSize: 10 },
  totalFinalValue: { color: C.white, fontFamily: "Helvetica-Bold", fontSize: 10 },
  // Handtekeningblok
  signBlock: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signCol: { width: "45%" },
  signLabel: { fontSize: 8, color: C.muted, marginBottom: 16 },
  signLine: { borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 4 },
  signName: { fontSize: 8, color: C.text },
  // Bankgegevens / footer info
  bankBox: {
    marginTop: 20,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  bankLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, color: C.dark, marginBottom: 3 },
  bankText: { fontSize: 8, color: C.muted, lineHeight: 1.6 },
  // Pagina footer (page number + bedrijfsinfo)
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: C.light },
  // Merkbalk onderaan documenten (huisstijl, naar voorbeeld branded footer)
  brandFooterBand: {
    backgroundColor: C.dark,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  brandFooterName: { fontSize: 7.5, color: C.white, fontFamily: "Helvetica-Bold" },
  brandFooterPage: { fontSize: 7, color: C.white },
  brandFooterDetails: { fontSize: 7, color: "#ffb380" },
  // AV pagina
  avPage: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: C.text,
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 40,
    lineHeight: 1.6,
  },
  avTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 10, color: C.dark },
  avSection: { marginBottom: 8 },
  avSectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 3, color: C.dark },
  avText: { fontSize: 7.5, color: C.text, lineHeight: 1.6 },
});

// ── Helpers ─────────────────────────────────────────────────────────────────
export function fmt(n: number, lang = "NL"): string {
  const locale = lang === "EN" ? "en-NL" : "nl-NL";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(n);
}

export function fmtDate(d: string | Date | null | undefined, lang = "NL"): string {
  if (!d) return "—";
  const locale = lang === "EN" ? "en-GB" : "nl-NL";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

// Taalsleutels
type LangKey =
  | "quote" | "invoice" | "deliveryNote" | "orderConfirmation"
  | "number" | "date" | "validUntil" | "paymentTerm" | "yourRef" | "ourRef"
  | "deliveryDate" | "deliveryAddress"
  | "description" | "qty" | "unitPrice" | "total"
  | "subtotal" | "vat21" | "totalIncl" | "totalDue"
  | "forApproval" | "contactPerson" | "bankDetails"
  | "termsTitle" | "termsFooterQuote" | "termsFooterInvoice"
  | "deliveredNote" | "signDistrixs" | "signCustomer";

const NL: Record<LangKey, string> = {
  quote: "Offerte",
  invoice: "Factuur",
  deliveryNote: "Leveringsbon",
  orderConfirmation: "Orderbevestiging",
  number: "Nummer",
  date: "Datum",
  validUntil: "Geldig tot",
  paymentTerm: "Betalingstermijn",
  yourRef: "Uw referentie",
  ourRef: "Onze referentie",
  deliveryDate: "Transportdatum",
  deliveryAddress: "Leveringsadres",
  description: "Beschrijving",
  qty: "Aantal",
  unitPrice: "Stukprijs",
  total: "Totaal",
  subtotal: "Totaal excl. btw",
  vat21: "Btw 21%",
  totalIncl: "Totaal incl. btw",
  totalDue: "Totaal te betalen",
  forApproval: "Voor akkoord",
  contactPerson: "Contact persoon",
  bankDetails: "Bankgegevens",
  termsTitle: "Algemene voorwaarden",
  termsFooterQuote: "Bij akkoord op de offerte wordt automatisch ook de algemene voorwaarden geaccepteerd",
  termsFooterInvoice: "Op al onze leveringen en diensten zijn de algemene voorwaarden van toepassing welke zijn bijgevoegd met deze factuur.",
  deliveredNote: "Artikelen in goede staat geleverd.",
  signDistrixs: "Distrixs",
  signCustomer: "Klant",
};

const EN: Record<LangKey, string> = {
  quote: "Quotation",
  invoice: "Invoice",
  deliveryNote: "Delivery Note",
  orderConfirmation: "Order Confirmation",
  number: "Number",
  date: "Date",
  validUntil: "Valid until",
  paymentTerm: "Payment term",
  yourRef: "Your reference",
  ourRef: "Our reference",
  deliveryDate: "Delivery date",
  deliveryAddress: "Delivery address",
  description: "Description",
  qty: "Qty",
  unitPrice: "Unit price",
  total: "Total",
  subtotal: "Subtotal excl. VAT",
  vat21: "VAT 21%",
  totalIncl: "Total incl. VAT",
  totalDue: "Total due",
  forApproval: "For approval",
  contactPerson: "Contact person",
  bankDetails: "Bank details",
  termsTitle: "General Terms and Conditions",
  termsFooterQuote: "By approving this quotation you automatically accept our general terms and conditions",
  termsFooterInvoice: "Our general terms and conditions apply to all our deliveries and services and are attached to this invoice.",
  deliveredNote: "Items delivered in good condition.",
  signDistrixs: "Distrixs",
  signCustomer: "Customer",
};

export function t(key: LangKey, lang = "NL"): string {
  return (lang === "EN" ? EN : NL)[key];
}

// Standaard Distrixs AV tekst (NL) — bijgewerkt vanuit www.distrixs.nl/algemene-voorwaarden/
export const DEFAULT_TERMS_NL = `De meest actuele versie van onze algemene voorwaarden is te vinden op: www.distrixs.nl/algemene-voorwaarden

Artikel 1 – Definities
Klant: bedrijven in bezit van een kvk of non profit organisatie. Leveringsdatum: door Distrixs aangegeven datum of periode wanneer producten en/of diensten worden geleverd. Prijs: prijs voor producten exclusief vervoerskosten, verzekering en BTW. Producten: zaken tot koop waarvan de klant zich tegenover Distrixs verbindt.

Artikel 2 – Toepasselijkheid
2.1 Deze Algemene Voorwaarden zijn van toepassing op alle aanbiedingen en overeenkomsten van Distrixs. 2.2 Afwijkingen vereisen expliciete schriftelijke overeenstemming. 2.3 Voorwaarden van de klant zijn niet van toepassing tenzij Distrixs hier uitdrukkelijk schriftelijk mee instemt. 2.4 Door het plaatsen van een bestelling accepteert de klant deze Algemene Voorwaarden.

Artikel 3 – Aanbiedingen en totstandkoming overeenkomst
3.1 Aanbiedingen gelden als uitnodigingen voor klanten om een aanbod te doen. 3.2 Aanbiedingen zijn geldig zolang de voorraad strekt. 3.4 Benoemde offertes zijn 10 dagen geldig tenzij anders vermeld. 3.6 Een overeenkomst komt tot stand wanneer Distrixs een aanbod aanvaardt, een orderbevestiging verstrekt of een bevestigingsmail het opgegeven adres bereikt.

Artikel 4 – Prijs en betaling
4.1 Prijzen en kosten inclusief transport, verzekering en BTW worden duidelijk vermeld in offertes, orderbevestigingen en facturen. 4.5 Indien betaling niet is ontvangen op de vervaldatum is de klant na ingebrekestelling de wettelijke rente verschuldigd. Niet-consumenten zijn de wettelijke rente vermeerderd met 2% verschuldigd. 4.6 De klant draagt alle gerechtelijke en buitengerechtelijke kosten bij betalingsverzuim. 4.9 Facturen zijn verschuldigd binnen 30 dagen tenzij anders overeengekomen.

Artikel 5 – Levering en levertijd
5.1 Bestellingen worden zo snel mogelijk geleverd. Vermelde levertijden zijn slechts indicatief en gelden nooit als fatale termijnen. 5.2 Levering vindt plaats op het bij de overeenkomst opgegeven adres. 5.3 Het risico gaat over op de klant zodra producten zijn afgeleverd op het opgegeven adres (bij orders tot EUR 5.000) of bij overhandiging aan de vervoerder (bij hogere bedragen).

Artikel 6 – Eigendomsvoorbehoud
6.1 Eigendom van producten gaat pas over nadat de klant alles heeft betaald wat hij verschuldigd is, inclusief rente en kosten. 6.2 De klant mag producten niet bezwaren, verkopen of verpanden voordat het eigendom is overgedragen.

Artikel 7 – Acceptatie en retourrecht
7.1 De klant dient producten onmiddellijk bij ontvangst te inspecteren. Klachten dienen schriftelijk te worden ingediend binnen 8 dagen na levering. 7.2 Producten mogen niet worden geretourneerd zonder toestemming van Distrixs. 7.5 Retourzendingskosten zijn voor rekening van de klant. 7.7 Klanten dienen vóór het retourneren van producten een RMA-nummer aan te vragen.

Artikel 8 – Garantie
8.1 Distrixs garandeert dat Producten 24 maanden vanaf de Leveringsdatum vrij zijn van gebreken, tenzij anders overeengekomen. 8.3 De garantie is niet van toepassing bij normale slijtage, ongeoorloofd gebruik of ontbrekende originele facturen.

Artikel 9 – Aansprakelijkheid
9.1 De aansprakelijkheid van Distrixs is onder alle omstandigheden beperkt tot de factuurwaarde. Distrixs is nimmer aansprakelijk voor gevolgschade, indirecte schade of gederfde winst/omzet. 9.2 De klant vrijwaart Distrixs tegen aanspraken van derden.

Artikel 10 – Overmacht
10.1 Distrixs is niet verplicht verplichtingen na te komen tijdens overmacht, waaronder stakingen, brand, energiestoringen, niet-levering door leveranciers of storingen in telecommunicatienetwerken.

Artikel 11 – Vertrouwelijkheid
Elke partij dient vertrouwelijke informatie van de andere partij met dezelfde zorg te behandelen als de eigen vertrouwelijke informatie.

Artikel 13 – Toepasselijk recht en bevoegde rechter
Nederlands recht is van toepassing op deze Voorwaarden. Nederlandse rechters zijn bevoegd voor geschillen.

Artikel 14 – Overige bepalingen
Distrixs B.V., Lorentzstraat 89, 2665 JG Bleiswijk. KvK: 99144492. BTW: NL868824323B01.`;

export const DEFAULT_TERMS_EN = `1 Definitions
Customer: companies in possession of a chamber of commerce registration or non-profit organisation. Delivery date: date or period indicated by Distrixs when products and/or services will be delivered. Price: price for products excluding transport, insurance and VAT.

2 Applicability
2.1 These General Terms and Conditions apply to all offers by Distrixs and to all agreements entered into with Distrixs. 2.2 Deviations from these Terms are only valid if expressly agreed in writing.

3 Offers and formation of agreements
3.4 A named quotation has a validity period of 10 days, unless another period is stated in the quotation.

4 Price and payment
4.1 The price payable by customers is clearly stated in Distrixs' quotation and/or order confirmation and invoice. 4.5 If payment is not received by the due date, the customer shall owe statutory interest after notice of default. 4.9 The customer must pay the invoice within 30 days unless otherwise agreed with Distrixs.

5 Delivery
5.1 Orders are delivered as quickly as possible. Stated delivery times are indicative only and never constitute a deadline. 5.2 Deliveries take place at the address specified by the customer.

6 Retention of title
6.1 Ownership of products transfers to the customer only after full payment of all amounts owed.

7 Acceptance and right of withdrawal
7.1 The customer must inspect products immediately upon receipt. Complaints must be reported in writing within 8 days of delivery. 7.7 Before returning a product, the customer must request an RMA number.

8 Warranty
8.1 Distrixs warrants that Products will be free from defects for 24 months from the Delivery Date unless otherwise agreed.

9 Liability
9.1 Distrixs limits its liability to the invoice value. Distrixs is never liable for consequential or business damage, indirect damage or loss of profit.

10 Force majeure
10.1 In case of force majeure, Distrixs is not required to fulfil its obligations to the customer.

13 Applicable law
Dutch law applies to our terms. Disputes shall be submitted to a competent court in the Netherlands.`;
