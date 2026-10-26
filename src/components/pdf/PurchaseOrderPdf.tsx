import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { shared, C, fmt, fmtDate, t, breakSku } from "./PdfLayout";

export interface PurchaseOrderPdfData {
  language?: string;
  poNumber: string;
  orderDate: string | Date;
  dealNumber?: string | null;
  notes?: string | null;
  company?: {
    companyName?: string | null;
    logoUrl?: string | null;
    addressLine1?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    kvkNumber?: string | null;
    vatNumber?: string | null;
  } | null;
  supplier: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  lines: Array<{
    skuSnapshot: string;
    titleSnapshot: string;
    qty: number;
    unitCost: number;
    lineTotal: number;
    expectedDeliveryDate?: string | Date | null;
  }>;
}

const S = StyleSheet.create({
  colDesc:  { flex: 1, paddingRight: 6 },
  colQty:   { width: "10%", textAlign: "right" },
  colPrice: { width: "17%", textAlign: "right" },
  colTotal: { width: "17%", textAlign: "right" },
  colDeliv: { width: "16%", textAlign: "right" },
  addrLabel: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 3, color: C.dark },
  addrText: { fontSize: 9, color: C.text, lineHeight: 1.6 },
});

export function PurchaseOrderPdf({ data }: { data: PurchaseOrderPdfData }) {
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
    co?.kvkNumber ? `KvK ${co.kvkNumber}` : null,
    co?.vatNumber ? `BTW ${co.vatNumber}` : null,
  ].filter(Boolean).join("\n");

  const supplierBlock = [
    data.supplier.name,
    data.supplier.email,
    data.supplier.phone,
  ].filter(Boolean).join("\n");

  const total = data.lines.reduce((s, l) => s + l.lineTotal, 0);
  const hasDelivery = data.lines.some((l) => l.expectedDeliveryDate);

  return (
    <Document title={`${t("purchaseOrder", lang)} ${data.poNumber}`} author={coName}>
      <Page size="A4" style={shared.page}>
        {/* Header */}
        <View style={shared.headerRow}>
          <View style={{ flex: 1 }}>
            {co?.logoUrl ? (
              <Image src={co.logoUrl} style={shared.logo} />
            ) : (
              <Text style={shared.logoText}>{coName}</Text>
            )}
            {/* Leverancier */}
            <View style={{ marginTop: 12 }}>
              <Text style={S.addrLabel}>{t("supplier", lang)}:</Text>
              <Text style={S.addrText}>{supplierBlock}</Text>
            </View>
          </View>
          <Text style={shared.companyAddrBlock}>{coAddr}</Text>
        </View>

        {/* Documenttitel */}
        <Text style={[shared.docTitle, { marginTop: 8 }]}>
          {t("purchaseOrder", lang)} {data.poNumber}
        </Text>

        {/* Meta */}
        <View style={[shared.metaRow, { marginBottom: 12 }]}>
          <View>
            <Text style={shared.metaLabel}>{t("number", lang)}</Text>
            <Text style={shared.metaValue}>{data.poNumber}</Text>
          </View>
          <View>
            <Text style={shared.metaLabel}>{t("date", lang)}</Text>
            <Text style={shared.metaValue}>{fmtDate(data.orderDate, lang)}</Text>
          </View>
          {data.dealNumber && (
            <View>
              <Text style={shared.metaLabel}>{t("ourRef", lang)}</Text>
              <Text style={shared.metaValue}>{data.dealNumber}</Text>
            </View>
          )}
        </View>

        {/* Regels */}
        <View>
          <View style={shared.tableHeader}>
            <Text style={[S.colDesc, shared.thText]}>{t("description", lang)}</Text>
            <Text style={[S.colQty, shared.thText]}>{t("qty", lang)}</Text>
            <Text style={[S.colPrice, shared.thText]}>{t("unitPrice", lang)}</Text>
            <Text style={[S.colTotal, shared.thText]}>{t("total", lang)}</Text>
            {hasDelivery && (
              <Text style={[S.colDeliv, shared.thText]}>{t("expectedDelivery", lang)}</Text>
            )}
          </View>
          {data.lines.map((line, i) => (
            <View key={i} style={i % 2 === 0 ? shared.tableRow : shared.tableRowAlt} wrap={false}>
              <Text style={S.colDesc}>
                {line.skuSnapshot ? `${breakSku(line.skuSnapshot)}: ` : ""}{line.titleSnapshot}
              </Text>
              <Text style={S.colQty}>{line.qty}</Text>
              <Text style={S.colPrice}>{fmt(line.unitCost, lang)}</Text>
              <Text style={S.colTotal}>{fmt(line.lineTotal, lang)}</Text>
              {hasDelivery && (
                <Text style={S.colDeliv}>
                  {line.expectedDeliveryDate ? fmtDate(line.expectedDeliveryDate, lang) : "—"}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Totaal (inkoopprijzen zijn excl. btw) */}
        <View style={shared.totalsBox}>
          <View style={shared.totalFinalRow}>
            <Text style={shared.totalFinalLabel}>{t("subtotal", lang)}</Text>
            <Text style={shared.totalFinalValue}>{fmt(total, lang)}</Text>
          </View>
        </View>

        {/* Opmerkingen */}
        {data.notes && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 9, color: C.text }}>{data.notes}</Text>
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 9, color: C.muted }}>{t("poFooterNote", lang)}</Text>
        </View>

        {/* Page footer */}
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
