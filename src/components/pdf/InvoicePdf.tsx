import { Document, Page, Text, View, Image, Link, StyleSheet } from "@react-pdf/renderer";
import { shared, C, fmt, fmtDate, t, DEFAULT_TERMS_NL, DEFAULT_TERMS_EN } from "./PdfLayout";

export interface InvoicePdfData {
  language?: string;
  isDraft?: boolean;
  invoiceNumber: string;
  invoiceDate: string | Date;
  dueDate: string | Date;
  paymentTermDays?: number;
  ourReference?: string | null;
  customerReference?: string | null;
  subtotal: number;
  vatAmount: number;
  total: number;
  openAmount?: number;
  reverseCharge?: boolean;
  installments?: Array<{
    installmentNumber: number;
    dueDate: string | Date;
    amount: number;
    percentage?: number | null;
    isPaid: boolean;
    notes?: string | null;
  }>;
  company?: {
    companyName?: string | null;
    logoUrl?: string | null;
    addressLine1?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    kvkNumber?: string | null;
    vatNumber?: string | null;
    iban?: string | null;
    bic?: string | null;
    bankName?: string | null;
    ibanAccountHolder?: string | null;
    email?: string | null;
    phone?: string | null;
    termsNl?: string | null;
    termsEn?: string | null;
  } | null;
  customer: {
    companyName: string;
    customerNumber?: string | null;
    contactName?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    vatNumber?: string | null;
    kvkNumber?: string | null;
  };
  lines: Array<{
    skuSnapshot: string;
    titleSnapshot: string;
    descriptionSnapshot?: string | null;
    qty: number;
    grossUnitPrice: number;
    discountPercent: number;
    netLineTotal: number;
  }>;
}

const S = StyleSheet.create({
  colSku:     { width: "13%", fontSize: 8, color: C.muted },
  colDesc:    { flex: 1 },
  colQty:     { width: "9%", textAlign: "right" },
  colPrice:   { width: "13%", textAlign: "right" },
  colDiscount:{ width: "10%", textAlign: "right", color: C.muted },
  colTotal:   { width: "14%", textAlign: "right" },
  discountRow:{ color: "#d97706", fontSize: 8 },
  // Meta header row (Nummer / Datum / Betaaltermijn / Uw referentie / FACTUUR)
  metaHeader: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingBottom: 6,
    marginBottom: 10,
    alignItems: "flex-end",
  },
  docTypeLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: C.orange,
    marginLeft: "auto",
  },
});

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const lang = data.language ?? "NL";
  const isDraft = data.isDraft ?? false;
  const co = data.company;
  const coName = co?.companyName ?? "Distrixs";

  const termsText = lang === "EN"
    ? (co?.termsEn ?? DEFAULT_TERMS_EN)
    : (co?.termsNl ?? DEFAULT_TERMS_NL);

  const coAddr = [
    coName,
    co?.addressLine1,
    co?.postalCode && co?.city ? `${co.postalCode} ${co.city}` : co?.city,
    co?.country ?? "Nederland",
    co?.email,
    co?.phone,
  ].filter(Boolean).join("\n");

  const custAddr = [
    data.customer.companyName,
    data.customer.contactName,
    data.customer.address,
    data.customer.postalCode && data.customer.city
      ? `${data.customer.postalCode} ${data.customer.city}`
      : data.customer.city,
    data.customer.country,
    data.customer.vatNumber ? `${lang === "EN" ? "VAT" : "BTW"}: ${data.customer.vatNumber}` : null,
    data.customer.kvkNumber ? `${lang === "EN" ? "CoC" : "KvK"}: ${data.customer.kvkNumber}` : null,
  ].filter(Boolean).join("\n");

  const paymentTermLabel = data.paymentTermDays
    ? (lang === "EN" ? `${data.paymentTermDays} days after invoice date` : `${data.paymentTermDays} dagen na facturatiedatum`)
    : (lang === "EN" ? "30 days" : "30 dagen");

  const footerIds = [
    co?.kvkNumber ? `KVK: ${co.kvkNumber}` : null,
    co?.vatNumber ? `BTW: ${co.vatNumber}` : null,
  ].filter(Boolean).join(" | ");

  return (
    <Document title={data.invoiceNumber} author={coName}>
      {/* ── Pagina 1 ── */}
      <Page size="A4" style={[shared.page, { paddingBottom: 160 }]}>
        {/* Header: klant links, Distrixs rechts */}
        <View style={shared.headerRow}>
          <View style={{ flex: 1 }}>
            {co?.logoUrl ? (
              <Image src={co.logoUrl} style={shared.logo} />
            ) : (
              <Text style={shared.logoText}>{coName}</Text>
            )}
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 9, lineHeight: 1.6 }}>{custAddr}</Text>
            </View>
          </View>
          <Text style={shared.companyAddrBlock}>{coAddr}</Text>
        </View>

        {/* Meta rij: Nummer | Datum | Betaaltermijn | Uw referentie | FACTUUR */}
        <View style={S.metaHeader}>
          <View style={{ marginRight: 24 }}>
            <Text style={shared.metaLabel}>{t("number", lang)}</Text>
            <Text style={shared.metaValue}>{data.invoiceNumber}</Text>
          </View>
          <View style={{ marginRight: 24 }}>
            <Text style={shared.metaLabel}>{t("date", lang)}</Text>
            <Text style={shared.metaValue}>{fmtDate(data.invoiceDate, lang)}</Text>
          </View>
          <View style={{ marginRight: 24 }}>
            <Text style={shared.metaLabel}>{lang === "EN" ? "Due date" : "Vervaldatum"}</Text>
            <Text style={shared.metaValue}>{fmtDate(data.dueDate, lang)}</Text>
          </View>
          {data.customer.customerNumber && (
            <View style={{ marginRight: 24 }}>
              <Text style={shared.metaLabel}>{lang === "EN" ? "Customer no." : "Klantnummer"}</Text>
              <Text style={shared.metaValue}>{data.customer.customerNumber}</Text>
            </View>
          )}
          <View style={{ marginRight: 24 }}>
            <Text style={shared.metaLabel}>{t("paymentTerm", lang)}</Text>
            <Text style={shared.metaValue}>{paymentTermLabel}</Text>
          </View>
          {data.customerReference && (
            <View style={{ marginRight: 24 }}>
              <Text style={shared.metaLabel}>{t("yourRef", lang)}</Text>
              <Text style={shared.metaValue}>{data.customerReference}</Text>
            </View>
          )}
          <Text style={S.docTypeLabel}>
            {isDraft
              ? (lang === "EN" ? "PROFORMA INVOICE" : "PROFORMA FACTUUR")
              : t("invoice", lang).toUpperCase()}
          </Text>
        </View>

        {/* Tabel */}
        <View>
          <View style={shared.tableHeader}>
            <Text style={[S.colSku,      shared.thText]}>SKU</Text>
            <Text style={[S.colDesc,     shared.thText]}>{t("description", lang)}</Text>
            <Text style={[S.colQty,      shared.thText]}>{t("qty", lang)}</Text>
            <Text style={[S.colPrice,    shared.thText]}>{t("unitPrice", lang)}</Text>
            <Text style={[S.colDiscount, shared.thText]}>{lang === "EN" ? "Discount" : "Korting"}</Text>
            <Text style={[S.colTotal,    shared.thText]}>{t("total", lang)}</Text>
          </View>
          {data.lines.flatMap((line, i) => {
            const grossTotal   = line.qty * line.grossUnitPrice;
            const hasDiscount  = line.discountPercent > 0;
            const netUnitPrice = hasDiscount
              ? line.grossUnitPrice * (1 - line.discountPercent / 100)
              : null;
            const discountAmount = hasDiscount ? line.netLineTotal - grossTotal : 0;
            const rowStyle = i % 2 === 0 ? shared.tableRow : shared.tableRowAlt;

            const rows = [
              <View key={`line-${i}`} style={rowStyle}>
                <Text style={S.colSku}>{line.skuSnapshot}</Text>
                <View style={S.colDesc}>
                  <Text>{line.titleSnapshot}</Text>
                  {line.descriptionSnapshot ? (
                    <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 1 }}>
                      {line.descriptionSnapshot}
                    </Text>
                  ) : null}
                </View>
                <Text style={S.colQty}>{line.qty}</Text>
                <Text style={S.colPrice}>{fmt(line.grossUnitPrice, lang)}</Text>
                <Text style={S.colDiscount}>
                  {hasDiscount ? `−${line.discountPercent}%` : "—"}
                </Text>
                <Text style={[S.colTotal, { fontFamily: "Helvetica-Bold" }]}>
                  {fmt(line.netLineTotal, lang)}
                </Text>
              </View>,
            ];

            if (hasDiscount) {
              rows.push(
                <View key={`discount-${i}`} style={{
                  flexDirection: "row",
                  paddingVertical: 3,
                  paddingHorizontal: 6,
                  backgroundColor: "#fffbf0",
                }}>
                  <Text style={[S.colSku, S.discountRow]} />
                  <Text style={[S.colDesc, S.discountRow]}>
                    {lang === "EN"
                      ? `−${line.discountPercent}% Discount`
                      : `−${line.discountPercent}% Korting`}
                  </Text>
                  <Text style={[S.colQty,      S.discountRow]}>1</Text>
                  <Text style={[S.colPrice,    S.discountRow]}>{fmt(netUnitPrice!, lang)}</Text>
                  <Text style={[S.colDiscount, S.discountRow]} />
                  <Text style={[S.colTotal,    S.discountRow]}>{fmt(discountAmount, lang)}</Text>
                </View>
              );
            }

            return rows;
          })}
        </View>

        {/* Totalen */}
        <View style={shared.totalsBox}>
          <View style={shared.totalsRow}>
            <Text style={shared.totalsLabel}>{t("subtotal", lang)}</Text>
            <Text style={shared.totalsValue}>{fmt(data.subtotal, lang)}</Text>
          </View>
          <View style={shared.totalsRow}>
            <Text style={shared.totalsLabel}>
              {data.reverseCharge ? (lang === "EN" ? "VAT reverse-charged" : "BTW verlegd") : t("vat21", lang)}
            </Text>
            <Text style={shared.totalsValue}>{fmt(data.vatAmount, lang)}</Text>
          </View>
          <View style={shared.totalsRow}>
            <Text style={shared.totalsLabel}>{t("totalIncl", lang)}</Text>
            <Text style={shared.totalsValue}>{fmt(data.total, lang)}</Text>
          </View>
          <View style={shared.totalFinalRow}>
            <Text style={shared.totalFinalLabel}>{t("totalDue", lang)}</Text>
            <Text style={shared.totalFinalValue}>{fmt(data.total, lang)}</Text>
          </View>
        </View>

        {/* Betalingsschema: termijnen zijn leidend voor de betaling */}
        {data.installments && data.installments.length > 0 && (
          <View style={{
            marginTop: 10,
            backgroundColor: "#f8fafc",
            borderWidth: 0.5,
            borderColor: "#cbd5e1",
            borderRadius: 3,
            padding: 8,
          }}>
            <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>
              {lang === "EN" ? "Payment schedule" : "Betalingsschema"}
            </Text>
            {data.installments.map((term) => (
              <View key={term.installmentNumber} style={{ flexDirection: "row", marginBottom: 2 }}>
                <Text style={{ fontSize: 8.5, width: 180 }}>
                  {lang === "EN" ? "Installment" : "Termijn"} {term.installmentNumber}
                  {term.percentage != null ? ` (${term.percentage}%)` : ""}
                  {term.notes ? ` — ${term.notes}` : ""}
                </Text>
                <Text style={{ fontSize: 8.5, width: 110 }}>
                  {lang === "EN" ? "due " : "vervalt "}{fmtDate(term.dueDate, lang)}
                </Text>
                <Text style={{ fontSize: 8.5, fontWeight: 700 }}>
                  {fmt(term.amount, lang)}
                  {term.isPaid ? (lang === "EN" ? "  (paid)" : "  (voldaan)") : ""}
                </Text>
              </View>
            ))}
            <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 3 }}>
              {lang === "EN"
                ? "Please pay each installment before its due date, stating the invoice number."
                : "Gelieve elke termijn vóór de bijbehorende vervaldatum te voldoen onder vermelding van het factuurnummer."}
            </Text>
          </View>
        )}

        {/* Btw verlegd (intracommunautaire levering) */}
        {data.reverseCharge && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 8.5, color: C.muted }}>
              {lang === "EN"
                ? `Intra-Community supply — VAT reverse-charged to the recipient.${data.customer.vatNumber ? ` Customer VAT no.: ${data.customer.vatNumber}` : ""}`
                : `Intracommunautaire levering — btw verlegd naar de afnemer.${data.customer.vatNumber ? ` Btw-nummer afnemer: ${data.customer.vatNumber}` : ""}`}
            </Text>
          </View>
        )}

        {/* Onze referentie */}
        {data.ourReference && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 8.5 }}>{t("ourRef", lang)}: {data.ourReference}</Text>
          </View>
        )}

        {/* Footer — vast onderaan de pagina: betaalinstructies + bankgegevens + AV + paginanummer */}
        <View style={{
          position: "absolute",
          bottom: 20,
          left: 40,
          right: 40,
        }} fixed>
          {/* Groen betaalinstructies blok */}
          <View style={{
            backgroundColor: "#f0faf4",
            borderWidth: 0.5,
            borderColor: "#a3d9b5",
            borderRadius: 3,
            padding: 8,
            marginBottom: 6,
          }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5, color: "#1a6b3a", marginBottom: 4 }}>
              {lang === "EN" ? "Payment instructions" : "Betaalinstructies"}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
              <Text style={{ fontSize: 8, color: "#2d6a4f" }}>{lang === "EN" ? "Pay before" : "Te betalen voor"}</Text>
              <Text style={{ fontSize: 8, color: "#1a6b3a", fontFamily: "Helvetica-Bold" }}>{fmtDate(data.dueDate, lang)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
              <Text style={{ fontSize: 8, color: "#2d6a4f" }}>{lang === "EN" ? "Amount" : "Bedrag"}</Text>
              <Text style={{ fontSize: 8, color: "#1a6b3a", fontFamily: "Helvetica-Bold" }}>{fmt(data.openAmount ?? data.total, lang)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
              <Text style={{ fontSize: 8, color: "#2d6a4f" }}>IBAN</Text>
              <Text style={{ fontSize: 8, color: "#1a6b3a", fontFamily: "Helvetica-Bold" }}>{co?.iban ?? "—"}</Text>
            </View>
            {co?.ibanAccountHolder && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                <Text style={{ fontSize: 8, color: "#2d6a4f" }}>{lang === "EN" ? "In the name of" : "T.n.v."}</Text>
                <Text style={{ fontSize: 8, color: "#1a6b3a", fontFamily: "Helvetica-Bold" }}>{co.ibanAccountHolder}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 8, color: "#2d6a4f" }}>{lang === "EN" ? "Reference" : "Onder vermelding van"}</Text>
              <Text style={{ fontSize: 8, color: "#1a6b3a", fontFamily: "Helvetica-Bold" }}>{data.invoiceNumber}</Text>
            </View>
          </View>

          {/* Merkbalk met bedrijfsgegevens (huisstijl) */}
          <View style={shared.brandFooterBand}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
              <Text style={shared.brandFooterName}>
                {[coName, co?.addressLine1, co?.postalCode && co?.city ? `${co.postalCode} ${co.city}` : co?.city]
                  .filter(Boolean).join("  |  ")}
              </Text>
              <Text style={shared.brandFooterPage} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
            </View>
            <Text style={shared.brandFooterDetails}>
              {[
                co?.phone,
                co?.email,
                co?.iban ? `IBAN: ${co.iban}` : null,
                co?.bic ? `BIC: ${co.bic}` : null,
                co?.kvkNumber ? `KVK: ${co.kvkNumber}` : null,
                co?.vatNumber ? `${lang === "EN" ? "VAT" : "BTW"}: ${co.vatNumber}` : null,
              ].filter(Boolean).join("  |  ")}
            </Text>
          </View>

          {/* AV tekst */}
          <Text style={[shared.footerText, { fontStyle: "italic", marginTop: 3 }]}>
            Op al onze leveringen en diensten zijn de algemene voorwaarden van toepassing welke zijn bijgevoegd met deze factuur.{"  "}
            The general terms and conditions that are attached to this invoice apply to all our deliveries and services.
          </Text>
        </View>
      </Page>

      {/* ── Algemene voorwaarden ── */}
      <Page size="A4" style={shared.avPage}>
        <View style={shared.headerRow}>
          {co?.logoUrl ? (
            <Image src={co.logoUrl} style={shared.logo} />
          ) : (
            <Text style={shared.logoText}>{coName}</Text>
          )}
        </View>
        <Text style={shared.avTitle}>{t("termsTitle", lang)}</Text>
        <Link src="https://www.distrixs.nl/algemene-voorwaarden/" style={{ fontSize: 8, color: C.blue, marginBottom: 10, textDecoration: "underline" }}>
          www.distrixs.nl/algemene-voorwaarden
        </Link>
        <Text style={shared.avText}>{termsText}</Text>
        <View style={shared.pageFooter} fixed>
          <Text style={shared.footerText}>{coName}</Text>
          <Text style={shared.footerText} render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  );
}
