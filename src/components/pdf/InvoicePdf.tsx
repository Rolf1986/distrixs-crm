import { Document, Page, Text, View, Image, Link, StyleSheet } from "@react-pdf/renderer";
import { shared, C, fmt, fmtDate, t, DEFAULT_TERMS_NL, DEFAULT_TERMS_EN } from "./PdfLayout";

export interface InvoicePdfData {
  language?: string;
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
    email?: string | null;
    phone?: string | null;
    termsNl?: string | null;
    termsEn?: string | null;
  } | null;
  customer: {
    companyName: string;
    contactName?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
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
    color: C.dark,
    marginLeft: "auto",
  },
});

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const lang = data.language ?? "NL";
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
      <Page size="A4" style={shared.page}>
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
            <Text style={shared.metaLabel}>{t("paymentTerm", lang)}</Text>
            <Text style={shared.metaValue}>{paymentTermLabel}</Text>
          </View>
          {data.customerReference && (
            <View style={{ marginRight: 24 }}>
              <Text style={shared.metaLabel}>{t("yourRef", lang)}</Text>
              <Text style={shared.metaValue}>{data.customerReference}</Text>
            </View>
          )}
          <Text style={S.docTypeLabel}>{t("invoice", lang).toUpperCase()}</Text>
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
            <Text style={shared.totalsLabel}>{t("vat21", lang)}</Text>
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

        {/* Referenties + betaalinstructie */}
        {data.ourReference && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 8.5 }}>{t("ourRef", lang)}: {data.ourReference}</Text>
          </View>
        )}
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 8.5 }}>
            {lang === "EN"
              ? `Please use the following reference: ${data.invoiceNumber}`
              : `Gebruik de volgende mededeling: ${data.invoiceNumber}`}
          </Text>
        </View>

        {/* Betaalinstructies — groen blok zoals in origineel */}
        <View style={{
          marginTop: 20,
          backgroundColor: "#f0faf4",
          borderWidth: 0.5,
          borderColor: "#a3d9b5",
          borderRadius: 3,
          padding: 10,
        }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: "#1a6b3a", marginBottom: 6 }}>
            {lang === "EN" ? "Payment instructions" : "Betaalinstructies"}
          </Text>
          {[
            {
              label: lang === "EN" ? "Pay before" : "Te betalen voor",
              value: fmtDate(data.dueDate, lang),
            },
            {
              label: lang === "EN" ? "Amount" : "Bedrag",
              value: fmt(data.openAmount ?? data.total, lang),
            },
            {
              label: "IBAN",
              value: co?.iban ?? "—",
            },
            {
              label: lang === "EN" ? "Reference" : "Onder vermelding van",
              value: data.invoiceNumber,
            },
          ].map((row, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
              <Text style={{ fontSize: 8.5, color: "#2d6a4f" }}>{row.label}</Text>
              <Text style={{ fontSize: 8.5, color: "#1a6b3a", fontFamily: "Helvetica-Bold" }}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Bankgegevens */}
        <View style={[shared.bankBox, { marginTop: 10 }]}>
          <Text style={shared.bankLabel}>{lang === "EN" ? "Bank details" : "Bankgegevens"}</Text>
          {co?.bankName && <Text style={shared.bankText}>{co.bankName}</Text>}
          {co?.iban    && <Text style={shared.bankText}>IBAN: {co.iban}</Text>}
          {co?.bic     && <Text style={shared.bankText}>SWIFT / BIC: {co.bic}</Text>}
          {co?.kvkNumber && <Text style={shared.bankText}>KVK: {co.kvkNumber}</Text>}
          {co?.vatNumber && <Text style={shared.bankText}>{lang === "EN" ? "VAT" : "BTW"}: {co.vatNumber}</Text>}
          <Text style={[shared.bankText, { marginTop: 6 }]}>
            Op al onze leveringen en diensten zijn de algemene voorwaarden van toepassing welke zijn bijgevoegd met deze factuur.
          </Text>
          <Text style={[shared.bankText, { marginTop: 2, fontStyle: "italic", color: "#888" }]}>
            The general terms and conditions that are attached to this invoice apply to all our deliveries and services.
          </Text>
        </View>

        {/* Page footer */}
        <View style={shared.pageFooter} fixed>
          <Text style={shared.footerText}>{footerIds}</Text>
          <Text style={shared.footerText} render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          } />
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
