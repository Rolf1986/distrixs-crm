import { Document, Page, Text, View, Image, Link, StyleSheet } from "@react-pdf/renderer";
import { shared, C, fmt, fmtDate, t, DEFAULT_TERMS_NL, DEFAULT_TERMS_EN } from "./PdfLayout";

export interface CreditNotePdfData {
  language?: string;
  creditNoteNumber: string;
  creditNoteDate: string | Date;
  invoiceNumber?: string | null;
  reason?: string | null;
  subtotal: number;
  vatAmount: number;
  total: number;
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
    email?: string | null;
    phone?: string | null;
    termsNl?: string | null;
    termsEn?: string | null;
  } | null;
  customer: {
    companyName: string;
    customerNumber?: string | null;
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
    qty: number;
    unitPrice: number;
    vatRate: number;
    lineTotal: number;
  }>;
}

const S = StyleSheet.create({
  colSku:   { width: "13%", fontSize: 8, color: C.muted },
  colDesc:  { flex: 1 },
  colQty:   { width: "9%", textAlign: "right" },
  colPrice: { width: "15%", textAlign: "right" },
  colVat:   { width: "10%", textAlign: "right", color: C.muted },
  colTotal: { width: "15%", textAlign: "right" },
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

export function CreditNotePdf({ data }: { data: CreditNotePdfData }) {
  const lang = data.language ?? "NL";
  const co = data.company;
  const coName = co?.companyName ?? "Distrixs";
  const docLabel = lang === "EN" ? "CREDIT NOTE" : "CREDITNOTA";

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
    data.customer.address,
    data.customer.postalCode && data.customer.city
      ? `${data.customer.postalCode} ${data.customer.city}`
      : data.customer.city,
    data.customer.country,
    data.customer.vatNumber ? `${lang === "EN" ? "VAT" : "BTW"}: ${data.customer.vatNumber}` : null,
    data.customer.kvkNumber ? `${lang === "EN" ? "CoC" : "KvK"}: ${data.customer.kvkNumber}` : null,
  ].filter(Boolean).join("\n");

  // Fallback: sommige (uit Teamleader geïmporteerde) creditnota's hebben geen
  // regels. Toon dan één samenvattende regel op basis van de totalen.
  const displayLines = data.lines.length > 0
    ? data.lines
    : [{
        skuSnapshot: "",
        titleSnapshot: data.invoiceNumber
          ? (lang === "EN" ? `Credit re. invoice ${data.invoiceNumber}` : `Creditering m.b.t. factuur ${data.invoiceNumber}`)
          : (lang === "EN" ? "Credit" : "Creditering"),
        qty: 1,
        unitPrice: data.subtotal,
        vatRate: data.subtotal > 0 ? Math.round((data.vatAmount / data.subtotal) * 100) : 21,
        lineTotal: data.subtotal,
      }];

  return (
    <Document title={data.creditNoteNumber} author={coName}>
      <Page size="A4" style={[shared.page, { paddingBottom: 130 }]}>
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

        {/* Meta rij */}
        <View style={S.metaHeader}>
          <View style={{ marginRight: 24 }}>
            <Text style={shared.metaLabel}>{t("number", lang)}</Text>
            <Text style={shared.metaValue}>{data.creditNoteNumber}</Text>
          </View>
          <View style={{ marginRight: 24 }}>
            <Text style={shared.metaLabel}>{t("date", lang)}</Text>
            <Text style={shared.metaValue}>{fmtDate(data.creditNoteDate, lang)}</Text>
          </View>
          {data.customer.customerNumber && (
            <View style={{ marginRight: 24 }}>
              <Text style={shared.metaLabel}>{lang === "EN" ? "Customer no." : "Klantnummer"}</Text>
              <Text style={shared.metaValue}>{data.customer.customerNumber}</Text>
            </View>
          )}
          {data.invoiceNumber && (
            <View style={{ marginRight: 24 }}>
              <Text style={shared.metaLabel}>{lang === "EN" ? "Invoice" : "Factuur"}</Text>
              <Text style={shared.metaValue}>{data.invoiceNumber}</Text>
            </View>
          )}
          <Text style={S.docTypeLabel}>{docLabel}</Text>
        </View>

        {/* Tabel */}
        <View>
          <View style={shared.tableHeader}>
            <Text style={[S.colSku,   shared.thText]}>SKU</Text>
            <Text style={[S.colDesc,  shared.thText]}>{t("description", lang)}</Text>
            <Text style={[S.colQty,   shared.thText]}>{t("qty", lang)}</Text>
            <Text style={[S.colPrice, shared.thText]}>{t("unitPrice", lang)}</Text>
            <Text style={[S.colVat,   shared.thText]}>{lang === "EN" ? "VAT %" : "BTW %"}</Text>
            <Text style={[S.colTotal, shared.thText]}>{t("total", lang)}</Text>
          </View>
          {displayLines.map((line, i) => (
            <View key={`line-${i}`} style={i % 2 === 0 ? shared.tableRow : shared.tableRowAlt}>
              <Text style={S.colSku}>{line.skuSnapshot}</Text>
              <View style={S.colDesc}>
                <Text>{line.titleSnapshot}</Text>
              </View>
              <Text style={S.colQty}>{line.qty}</Text>
              <Text style={S.colPrice}>{fmt(line.unitPrice, lang)}</Text>
              <Text style={S.colVat}>{line.vatRate}%</Text>
              <Text style={[S.colTotal, { fontFamily: "Helvetica-Bold" }]}>{fmt(line.lineTotal, lang)}</Text>
            </View>
          ))}
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
          <View style={shared.totalFinalRow}>
            <Text style={shared.totalFinalLabel}>{lang === "EN" ? "Total credited" : "Totaal gecrediteerd"}</Text>
            <Text style={shared.totalFinalValue}>{fmt(data.total, lang)}</Text>
          </View>
        </View>

        {/* Reden / toelichting */}
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 8.5, color: C.muted }}>
            {data.reason
              ? `${lang === "EN" ? "Reason" : "Reden"}: ${data.reason}`
              : (lang === "EN"
                  ? `This credit note reduces the amount due on invoice ${data.invoiceNumber ?? ""}.`
                  : `Deze creditnota vermindert het verschuldigde bedrag van factuur ${data.invoiceNumber ?? ""}.`)}
          </Text>
        </View>

        {/* Merkbalk met bedrijfsgegevens (huisstijl) */}
        <View style={{ position: "absolute", bottom: 20, left: 40, right: 40 }} fixed>
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
          <Text style={shared.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
