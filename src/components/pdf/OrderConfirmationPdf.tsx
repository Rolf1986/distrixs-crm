import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { shared, C, fmt, fmtDate, t } from "./PdfLayout";

export interface OrderConfirmationPdfData {
  language?: string;
  confirmationNumber: string;
  confirmationDate: string | Date;
  expectedDelivery?: string | Date | null;
  projectName?: string | null;
  quoteNumber?: string | null;
  notes?: string | null;
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
    qty: number;
    grossUnitPrice: number;
    discountPercent: number;
    netLineTotal: number;
    deliveryDate?: string | Date | null;
  }>;
}

const S = StyleSheet.create({
  colSku:      { width: "12%", fontSize: 8, color: C.muted },
  colDesc:     { flex: 1 },
  colQty:      { width: "7%", textAlign: "right" },
  colPrice:    { width: "12%", textAlign: "right" },
  colTotal:    { width: "13%", textAlign: "right" },
  colDelivery: { width: "14%", textAlign: "right" },
  docTypeLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: C.orange,
    marginLeft: "auto",
  },
  metaHeader: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingBottom: 6,
    marginBottom: 10,
    alignItems: "flex-end",
  },
});

export function OrderConfirmationPdf({ data }: { data: OrderConfirmationPdfData }) {
  const lang = data.language ?? "NL";
  const co = data.company;
  const coName = co?.companyName ?? "Distrixs";

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

  const title = lang === "EN" ? "ORDER CONFIRMATION" : "ORDERBEVESTIGING";

  return (
    <Document title={data.confirmationNumber} author={coName}>
      <Page size="A4" style={[shared.page, { paddingBottom: 110 }]}>
        {/* Header */}
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

        {/* Meta */}
        <View style={S.metaHeader}>
          <View style={{ marginRight: 24 }}>
            <Text style={shared.metaLabel}>{t("number", lang)}</Text>
            <Text style={shared.metaValue}>{data.confirmationNumber}</Text>
          </View>
          <View style={{ marginRight: 24 }}>
            <Text style={shared.metaLabel}>{t("date", lang)}</Text>
            <Text style={shared.metaValue}>{fmtDate(data.confirmationDate, lang)}</Text>
          </View>
          {data.quoteNumber && (
            <View style={{ marginRight: 24 }}>
              <Text style={shared.metaLabel}>{lang === "EN" ? "Quotation" : "Offerte"}</Text>
              <Text style={shared.metaValue}>{data.quoteNumber}</Text>
            </View>
          )}
          {data.expectedDelivery && (
            <View style={{ marginRight: 24 }}>
              <Text style={shared.metaLabel}>{lang === "EN" ? "Expected delivery" : "Verwachte levering"}</Text>
              <Text style={shared.metaValue}>{fmtDate(data.expectedDelivery, lang)}</Text>
            </View>
          )}
          <Text style={S.docTypeLabel}>{title}</Text>
        </View>

        {data.projectName && (
          <Text style={{ fontSize: 9, color: C.muted, marginBottom: 8 }}>
            {lang === "EN" ? "Regarding" : "Betreft"}: {data.projectName}
          </Text>
        )}

        {/* Tabel */}
        <View>
          <View style={shared.tableHeader}>
            <Text style={[S.colSku,      shared.thText]}>SKU</Text>
            <Text style={[S.colDesc,     shared.thText]}>{t("description", lang)}</Text>
            <Text style={[S.colQty,      shared.thText]}>{t("qty", lang)}</Text>
            <Text style={[S.colPrice,    shared.thText]}>{t("unitPrice", lang)}</Text>
            <Text style={[S.colTotal,    shared.thText]}>{t("total", lang)}</Text>
            <Text style={[S.colDelivery, shared.thText]}>{lang === "EN" ? "Delivery" : "Levering"}</Text>
          </View>
          {data.lines.map((line, i) => (
            <View key={i} style={i % 2 === 0 ? shared.tableRow : shared.tableRowAlt}>
              <Text style={S.colSku}>{line.skuSnapshot}</Text>
              <Text style={S.colDesc}>{line.titleSnapshot}</Text>
              <Text style={S.colQty}>{line.qty}</Text>
              <Text style={S.colPrice}>{fmt(line.grossUnitPrice, lang)}</Text>
              <Text style={S.colTotal}>{fmt(line.netLineTotal, lang)}</Text>
              <Text style={S.colDelivery}>
                {line.deliveryDate
                  ? fmtDate(line.deliveryDate, lang)
                  : data.expectedDelivery
                  ? fmtDate(data.expectedDelivery, lang)
                  : "—"}
              </Text>
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
            <Text style={shared.totalFinalLabel}>{t("total", lang)}</Text>
            <Text style={shared.totalFinalValue}>{fmt(data.total, lang)}</Text>
          </View>
        </View>

        {data.notes && (
          <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 10 }}>{data.notes}</Text>
        )}

        {/* Footer — merkbalk */}
        <View style={{ position: "absolute", bottom: 20, left: 48, right: 48 }}>
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
                co?.kvkNumber ? `KVK: ${co.kvkNumber}` : null,
                co?.vatNumber ? `${lang === "EN" ? "VAT" : "BTW"}: ${co.vatNumber}` : null,
              ].filter(Boolean).join("  |  ")}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
