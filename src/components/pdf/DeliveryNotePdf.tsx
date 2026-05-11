import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { shared, C, fmtDate, t } from "./PdfLayout";

export interface DeliveryNotePdfData {
  language?: string;
  noteNumber: string;
  deliveryDate: string | Date;
  customerReference?: string | null;
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
    contactPersonName?: string | null;
  } | null;
  customer: {
    companyName: string;
    contactName?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  };
  deliveryAddress?: {
    companyName?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  lines: Array<{
    skuSnapshot: string;
    titleSnapshot: string;
    qty: number;
  }>;
}

const S = StyleSheet.create({
  colDesc: { flex: 1 },
  colQty:  { width: "15%", textAlign: "right" },
  addrSection: { marginBottom: 16 },
  addrLabel: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 3, color: C.dark },
  addrText: { fontSize: 9, color: C.text, lineHeight: 1.6 },
});

export function DeliveryNotePdf({ data }: { data: DeliveryNotePdfData }) {
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

  const delivAddr = data.deliveryAddress ? [
    data.deliveryAddress.companyName,
    data.deliveryAddress.address,
    data.deliveryAddress.postalCode && data.deliveryAddress.city
      ? `${data.deliveryAddress.postalCode} ${data.deliveryAddress.city}`
      : data.deliveryAddress.city,
    data.deliveryAddress.country,
  ].filter(Boolean).join("\n") : null;

  return (
    <Document title={`${t("deliveryNote", lang)} ${data.noteNumber}`} author={coName}>
      <Page size="A4" style={shared.page}>
        {/* Header */}
        <View style={shared.headerRow}>
          <View style={{ flex: 1 }}>
            {co?.logoUrl ? (
              <Image src={co.logoUrl} style={shared.logo} />
            ) : (
              <Text style={shared.logoText}>{coName}</Text>
            )}
            {/* Factuuradres klant */}
            <View style={{ marginTop: 12 }}>
              <Text style={S.addrText}>{custAddr}</Text>
            </View>
            {/* Leveringsadres (indien afwijkend) */}
            {delivAddr && (
              <View style={{ marginTop: 12 }}>
                <Text style={S.addrLabel}>{t("deliveryAddress", lang)}:</Text>
                <Text style={S.addrText}>{delivAddr}</Text>
              </View>
            )}
          </View>
          <Text style={shared.companyAddrBlock}>{coAddr}</Text>
        </View>

        {/* Documenttitel */}
        <Text style={[shared.docTitle, { marginTop: 8 }]}>{t("deliveryNote", lang)}</Text>

        {/* Meta */}
        <View style={[shared.metaRow, { marginBottom: 12 }]}>
          <View>
            <Text style={shared.metaLabel}>{t("ourRef", lang)}</Text>
            <Text style={shared.metaValue}>{data.noteNumber}</Text>
          </View>
          <View>
            <Text style={shared.metaLabel}>{t("deliveryDate", lang)}</Text>
            <Text style={shared.metaValue}>{fmtDate(data.deliveryDate, lang)}</Text>
          </View>
          {data.customerReference && (
            <View>
              <Text style={shared.metaLabel}>{t("yourRef", lang)}</Text>
              <Text style={shared.metaValue}>{data.customerReference}</Text>
            </View>
          )}
        </View>

        {/* Tabel (geen prijzen) */}
        <View>
          <View style={shared.tableHeader}>
            <Text style={[S.colDesc, shared.thText]}>{t("description", lang)}</Text>
            <Text style={[S.colQty, shared.thText]}>{t("qty", lang)}</Text>
          </View>
          {data.lines.map((line, i) => (
            <View key={i} style={i % 2 === 0 ? shared.tableRow : shared.tableRowAlt}>
              <Text style={S.colDesc}>
                {line.skuSnapshot ? `${line.skuSnapshot}: ` : ""}{line.titleSnapshot}
              </Text>
              <Text style={S.colQty}>{line.qty}</Text>
            </View>
          ))}
        </View>

        {/* Opmerkingen */}
        {data.notes && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 9, color: C.text }}>{data.notes}</Text>
          </View>
        )}

        {/* Standaard aflevernotitie */}
        {!data.notes && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 9, color: C.muted }}>{t("deliveredNote", lang)}</Text>
          </View>
        )}

        {/* Handtekeningblok: Distrixs | Klant */}
        <View style={[shared.signBlock, { marginTop: 40 }]}>
          <View style={shared.signCol}>
            <View style={shared.signLine}>
              <Text style={shared.signName}>{coName}</Text>
              {co?.contactPersonName && (
                <Text style={shared.signName}>{co.contactPersonName}</Text>
              )}
            </View>
          </View>
          <View style={shared.signCol}>
            <View style={shared.signLine}>
              <Text style={shared.signName}>{data.customer.companyName}</Text>
              {data.customer.contactName && (
                <Text style={shared.signName}>{data.customer.contactName}</Text>
              )}
            </View>
          </View>
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
