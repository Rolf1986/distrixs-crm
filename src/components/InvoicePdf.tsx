import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: "#1e293b", padding: "30mm 20mm" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  companyName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0170B9" },
  companyMeta: { fontSize: 8, color: "#64748b", marginTop: 2, lineHeight: 1.5 },
  docTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  docMeta: { fontSize: 8, color: "#64748b", lineHeight: 1.6 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  addressBlock: { fontSize: 9, lineHeight: 1.6 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 5, paddingHorizontal: 8, marginBottom: 1 },
  tableRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  colSku: { width: "12%", fontSize: 8, color: "#64748b" },
  colTitle: { flex: 1, fontSize: 9 },
  colQty: { width: "10%", textAlign: "right", fontSize: 9 },
  colPrice: { width: "14%", textAlign: "right", fontSize: 9 },
  colDiscount: { width: "10%", textAlign: "right", fontSize: 9, color: "#64748b" },
  colTotal: { width: "15%", textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 9 },
  headerText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#64748b" },
  totalsBox: { marginTop: 12, alignSelf: "flex-end", width: "40%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  totalsLabel: { color: "#64748b" },
  totalsValue: { fontFamily: "Helvetica-Bold" },
  totalFinalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, backgroundColor: "#0170B9", paddingHorizontal: 8, borderRadius: 3, marginTop: 4 },
  totalFinalLabel: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 10 },
  totalFinalValue: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 10 },
  footer: { position: "absolute", bottom: "15mm", left: "20mm", right: "20mm", borderTopWidth: 0.5, borderTopColor: "#cbd5e1", paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#94a3b8" },
  paymentBox: { marginTop: 20, padding: 10, backgroundColor: "#f0fdf4", borderRadius: 4 },
  paymentBoxTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#166534", marginBottom: 6 },
  paymentBoxRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#166534", marginBottom: 2 },
  terms: { marginTop: 24, fontSize: 8, color: "#64748b", lineHeight: 1.6 },
});

function fmt(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("nl-NL").format(new Date(d));
}

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string | Date;
  dueDate: string | Date;
  subtotal: number;
  vatAmount: number;
  total: number;
  openAmount: number;
  quoteNumber?: string | null;
  ourReference?: string | null;
  company?: {
    companyName?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    postalCode?: string | null;
    kvkNumber?: string | null;
    vatNumber?: string | null;
    iban?: string | null;
    bic?: string | null;
    email?: string | null;
    phone?: string | null;
    invoiceFooter?: string | null;
  } | null;
  customer: {
    companyName: string;
    kvkNumber?: string | null;
    vatNumber?: string | null;
    address?: string;
  };
  contact?: {
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
  lines: Array<{
    skuSnapshot: string;
    titleSnapshot: string;
    qty: number;
    grossUnitPrice: number;
    discountPercent: number;
    netLineTotal: number;
  }>;
}

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const co = data.company;
  const coName = co?.companyName ?? "Distrixs";
  const coMeta = [
    co?.addressLine1 && co?.city ? `${co.addressLine1}, ${co.postalCode ?? ""} ${co.city}`.trim() : null,
    co?.kvkNumber ? `KVK: ${co.kvkNumber}` : null,
    co?.vatNumber ? `BTW: ${co.vatNumber}` : null,
    co?.iban ? `IBAN: ${co.iban}` : null,
  ].filter(Boolean).join("\n");

  return (
    <Document title={data.invoiceNumber} author={coName}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.companyName}>{coName}</Text>
            <Text style={S.companyMeta}>{coMeta || "Uw betrouwbare handelspartner"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={S.docTitle}>Factuur</Text>
            <Text style={S.docMeta}>
              {`Nummer: ${data.invoiceNumber}\nDatum: ${fmtDate(data.invoiceDate)}\nVervaldatum: ${fmtDate(data.dueDate)}`}
              {data.quoteNumber ? `\nRef. offerte: ${data.quoteNumber}` : ""}
              {data.ourReference ? `\nOnze referentie: ${data.ourReference}` : ""}
            </Text>
          </View>
        </View>

        {/* Customer address */}
        <View style={[S.section, { marginBottom: 24 }]}>
          <Text style={S.sectionTitle}>Aan</Text>
          <Text style={S.addressBlock}>
            {data.customer.companyName}
            {data.contact ? `\nt.a.v. ${data.contact.firstName} ${data.contact.lastName}` : ""}
            {data.customer.address ? `\n${data.customer.address}` : ""}
            {data.customer.vatNumber ? `\nBTW: ${data.customer.vatNumber}` : ""}
          </Text>
        </View>

        {/* Lines table */}
        <View style={S.section}>
          <View style={S.tableHeader}>
            <Text style={[S.colSku, S.headerText]}>SKU</Text>
            <Text style={[S.colTitle, S.headerText]}>Omschrijving</Text>
            <Text style={[S.colQty, S.headerText]}>Aantal</Text>
            <Text style={[S.colPrice, S.headerText]}>Prijs</Text>
            <Text style={[S.colDiscount, S.headerText]}>Korting</Text>
            <Text style={[S.colTotal, S.headerText]}>Totaal</Text>
          </View>
          {data.lines.map((line, i) => (
            <View key={i} style={S.tableRow}>
              <Text style={S.colSku}>{line.skuSnapshot}</Text>
              <Text style={S.colTitle}>{line.titleSnapshot}</Text>
              <Text style={S.colQty}>{line.qty}</Text>
              <Text style={S.colPrice}>{fmt(line.grossUnitPrice)}</Text>
              <Text style={S.colDiscount}>
                {line.discountPercent > 0 ? `${line.discountPercent}%` : "—"}
              </Text>
              <Text style={S.colTotal}>{fmt(line.netLineTotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={S.totalsBox}>
          <View style={S.totalsRow}>
            <Text style={S.totalsLabel}>Subtotaal excl. BTW</Text>
            <Text style={S.totalsValue}>{fmt(data.subtotal)}</Text>
          </View>
          <View style={S.totalsRow}>
            <Text style={S.totalsLabel}>BTW 21%</Text>
            <Text style={S.totalsValue}>{fmt(data.vatAmount)}</Text>
          </View>
          <View style={S.totalFinalRow}>
            <Text style={S.totalFinalLabel}>Totaal incl. BTW</Text>
            <Text style={S.totalFinalValue}>{fmt(data.total)}</Text>
          </View>
        </View>

        {/* Payment instructions */}
        <View style={S.paymentBox}>
          <Text style={S.paymentBoxTitle}>Betaalinstructies</Text>
          <View style={S.paymentBoxRow}>
            <Text>Te betalen voor</Text>
            <Text>{fmtDate(data.dueDate)}</Text>
          </View>
          <View style={S.paymentBoxRow}>
            <Text>Bedrag</Text>
            <Text>{fmt(data.openAmount > 0 ? data.openAmount : data.total)}</Text>
          </View>
          <View style={S.paymentBoxRow}>
            <Text>IBAN</Text>
            <Text>{co?.iban ?? "—"}</Text>
          </View>
          <View style={S.paymentBoxRow}>
            <Text>Onder vermelding van</Text>
            <Text>{data.invoiceNumber}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={S.terms}>
          <Text>
            {co?.invoiceFooter ?? "Alle bedragen zijn exclusief BTW tenzij anders aangegeven. Bij overschrijding van de betalingstermijn wordt rente in rekening gebracht."}
          </Text>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            {[coName, co?.email, co?.phone, co?.kvkNumber ? `KVK: ${co.kvkNumber}` : null].filter(Boolean).join(" · ")}
          </Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
