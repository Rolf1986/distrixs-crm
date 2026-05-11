import { Document, Page, Text, View, Image, Link, StyleSheet } from "@react-pdf/renderer";
import { shared, C, fmt, fmtDate, t, DEFAULT_TERMS_NL, DEFAULT_TERMS_EN } from "./PdfLayout";

export interface QuotePdfData {
  language?: string;
  quoteNumber: string;
  projectName?: string;
  quoteDate: string | Date;
  validUntil: string | Date | null;
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
    bankName?: string | null;
    email?: string | null;
    phone?: string | null;
    contactPersonName?: string | null;
    contactPersonPhone?: string | null;
    contactPersonEmail?: string | null;
    termsNl?: string | null;
    termsEn?: string | null;
    quoteTerms?: string | null;
  } | null;
  customer: {
    companyName: string;
    contactName?: string | null;
    email?: string | null;
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
  discountRow:{ color: "#d97706", fontSize: 8 },  // oranje voor korting
  subRow:     { color: C.muted, fontSize: 8 },
});

export function QuotePdf({ data }: { data: QuotePdfData }) {
  const lang = data.language ?? "NL";
  const co = data.company;
  const coName = co?.companyName ?? "Distrixs";

  const termsText = lang === "EN"
    ? (co?.termsEn ?? DEFAULT_TERMS_EN)
    : (co?.termsNl ?? DEFAULT_TERMS_NL);

  const docTitle = data.projectName
    ? `${t("quote", lang)} ${data.quoteNumber}: ${data.projectName}`
    : `${t("quote", lang)} ${data.quoteNumber}`;

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
    data.customer.email,
    data.customer.address,
    data.customer.postalCode && data.customer.city
      ? `${data.customer.postalCode} ${data.customer.city}`
      : data.customer.city,
    data.customer.country,
  ].filter(Boolean).join("\n");

  const footerIds = [
    co?.kvkNumber ? `kvk: ${co.kvkNumber}` : null,
    co?.vatNumber ? `BTW ${co.vatNumber}` : null,
    co?.iban ? `IBAN: ${co.iban}` : null,
    co?.bic ? `BIC: ${co.bic}` : null,
  ].filter(Boolean).join(" | ");

  return (
    <Document title={docTitle} author={coName}>
      {/* ── Pagina 1: document ── */}
      <Page size="A4" style={shared.page}>
        {/* Header */}
        <View style={shared.headerRow}>
          <View>
            {co?.logoUrl ? (
              <Image src={co.logoUrl} style={shared.logo} />
            ) : (
              <Text style={shared.logoText}>{coName}</Text>
            )}
          </View>
          <Text style={shared.companyAddrBlock}>{coAddr}</Text>
        </View>

        {/* Klantadres */}
        <View style={[shared.customerBlock, { marginBottom: 24 }]}>
          <Text>{custAddr}</Text>
        </View>

        {/* Documenttitel + meta */}
        <Text style={shared.docTitle}>{docTitle}</Text>
        <View style={shared.metaRow}>
          <View>
            <Text style={shared.metaLabel}>{t("number", lang)}</Text>
            <Text style={shared.metaValue}>{data.quoteNumber}</Text>
          </View>
          <View>
            <Text style={shared.metaLabel}>{t("date", lang)}</Text>
            <Text style={shared.metaValue}>{fmtDate(data.quoteDate, lang)}</Text>
          </View>
          {data.validUntil && (
            <View>
              <Text style={shared.metaLabel}>{t("validUntil", lang)}</Text>
              <Text style={shared.metaValue}>{fmtDate(data.validUntil, lang)}</Text>
            </View>
          )}
        </View>

        {/* Tabel — kolommen: SKU | Omschrijving | Aantal | Stukprijs | Korting | Totaal */}
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
            const grossTotal  = line.qty * line.grossUnitPrice;
            const hasDiscount = line.discountPercent > 0;
            const netUnitPrice = hasDiscount
              ? line.grossUnitPrice * (1 - line.discountPercent / 100)
              : null;
            const discountAmount = hasDiscount ? line.netLineTotal - grossTotal : 0; // negatief
            const rowStyle = i % 2 === 0 ? shared.tableRow : shared.tableRowAlt;

            const rows = [
              // ── Hoofdregel: brutoprijs + korting% + nettototaal ──────────────
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
                {/* Totaal = netto (na korting) */}
                <Text style={[S.colTotal, { fontFamily: "Helvetica-Bold" }]}>
                  {fmt(line.netLineTotal, lang)}
                </Text>
              </View>,
            ];

            // ── Kortingsregel: negatief bedrag (zoals Teamleader) ──────────────
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

        {/* Handtekeningblok */}
        <View style={shared.signBlock}>
          <View style={shared.signCol}>
            <Text style={shared.signLabel}>{t("forApproval", lang)}</Text>
            <View style={shared.signLine}>
              <Text style={shared.signName}>{t("contactPerson", lang)}:</Text>
              {co?.contactPersonName && <Text style={shared.signName}>{co.contactPersonName}</Text>}
              {co?.contactPersonPhone && <Text style={shared.signName}>{co.contactPersonPhone}</Text>}
              {co?.contactPersonEmail && <Text style={shared.signName}>{co.contactPersonEmail}</Text>}
            </View>
          </View>
        </View>

        {/* Footer bottom */}
        <View style={shared.pageFooter} fixed>
          <View style={{ flex: 1 }}>
            <Text style={shared.footerText}>
              Bij akkoord op de offerte wordt automatisch ook de algemene voorwaarden geaccepteerd.
            </Text>
            {footerIds ? (
              <Text style={[shared.footerText, { marginTop: 2 }]}>{footerIds}</Text>
            ) : null}
          </View>
          <Text style={shared.footerText} render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          } />
        </View>
      </Page>

      {/* ── Pagina 2+: Algemene voorwaarden ── */}
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
