import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { IClientSnapshot } from "@/models/Invoice";
import type { ICompanySettings } from "@/models/User";
import { formatEUR, formatDateDE, safeRound2 } from "@/lib/formatters";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type IInvoiceLean = {
  _id: string;
  invoiceNumber: string;
  status?: string;
  issuedAt?: Date;
  dueAt?: Date;
  paidAt?: Date;
  locked?: boolean;
  items: {
    title: string;
    lines?: string[];
    qty: number;
    unitPrice: number;
  }[];
  clientSnapshot?: IClientSnapshot;
  currency?: string;
  subtotal: number;
  total: number;
  kleinunternehmerText: string;
  footerText?: string;
  stornoOf?: string;
  stornoId?: string;
  buyerReference?: string;
};

// ─────────────────────────────────────────────
// Hyphenation off
// ─────────────────────────────────────────────

Font.registerHyphenationCallback((word) => [word]);

// ─────────────────────────────────────────────
// Paleta
// ─────────────────────────────────────────────

const C = {
  navy:         "#0f1621",   // fondo header
  navyMid:      "#162030",   // fondo tabla header
  lime:         "#c8f04a",   // acento principal
  storno:       "#f04a8c",   // acento storno
  white:        "#ffffff",
  offwhite:     "#f7f8fa",   // filas alternas
  text:         "#1a1b1e",   // texto principal
  textMid:      "#4a4d5a",   // texto secundario
  textSoft:     "#8a8d9a",   // labels / hints
  border:       "#e4e6ee",   // bordes tabla
  payBg:        "#f0f2f8",   // fondo bloque pago
} as const;

const PAD = 44;

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily:      "Helvetica",
    fontSize:        10,
    color:           C.text,
    backgroundColor: C.white,
  },

  // ── Barra lime superior ───────────────────
  topBar: {
    height:          4,
    backgroundColor: C.lime,
  },
  topBarStorno: {
    height:          4,
    backgroundColor: C.storno,
  },

  // ── Header ────────────────────────────────
  header: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "flex-start",
    backgroundColor:   C.navy,
    paddingHorizontal: PAD,
    paddingTop:        28,
    paddingBottom:     28,
  },
  headerLeft: {
    flex: 1,
  },
  companyName: {
    fontSize:      22,
    fontFamily:    "Helvetica-Bold",
    color:         C.white,
    letterSpacing: 0.8,
    marginBottom:  6,
  },
  companyMeta: {
    fontSize:    9,
    color:       "#6a7a8a",
    lineHeight:  1.6,
  },
  headerRight: {
    alignItems:  "flex-end",
    paddingLeft: 24,
  },
  invoiceLabel: {
    fontSize:      9,
    fontFamily:    "Helvetica-Bold",
    color:         C.lime,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom:  6,
  },
  invoiceLabelStorno: {
    fontSize:      9,
    fontFamily:    "Helvetica-Bold",
    color:         C.storno,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom:  6,
  },
  invoiceNumber: {
    fontSize:      24,
    fontFamily:    "Helvetica-Bold",
    color:         C.white,
    letterSpacing: 0.5,
  },
  invoiceDate: {
    fontSize:   9,
    color:      "#6a7a8a",
    marginTop:  5,
  },

  // ── Body ──────────────────────────────────
  body: {
    paddingHorizontal: PAD,
    paddingTop:        28,
    paddingBottom:     72,
  },

  // ── Von / An ──────────────────────────────
  partyRow: {
    flexDirection:     "row",
    marginBottom:      24,
    paddingBottom:     20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  partyCol: { flex: 1 },
  partySep: {
    width:            1,
    backgroundColor:  C.border,
    marginHorizontal: 28,
  },
  partyTag: {
    fontSize:      7.5,
    fontFamily:    "Helvetica-Bold",
    color:         C.lime,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom:  7,
    backgroundColor: C.navy,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius:  2,
    alignSelf:     "flex-start",
  },
  partyTagStorno: {
    fontSize:      7.5,
    fontFamily:    "Helvetica-Bold",
    color:         C.storno,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom:  7,
    backgroundColor: C.navy,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius:  2,
    alignSelf:     "flex-start",
  },
  partyName: {
    fontSize:     11,
    fontFamily:   "Helvetica-Bold",
    color:        C.text,
    marginBottom: 3,
  },
  partyLine: {
    fontSize:   9,
    color:      C.textMid,
    lineHeight: 1.55,
  },

  // ── Fechas ────────────────────────────────
  datesRow: {
    flexDirection: "row",
    gap:           8,
    marginBottom:  24,
  },
  dateCell: {
    flex:              1,
    backgroundColor:   C.offwhite,
    borderRadius:      5,
    paddingVertical:   10,
    paddingHorizontal: 12,
    borderTopWidth:    2,
    borderTopColor:    C.lime,
  },
  dateCellStorno: {
    flex:              1,
    backgroundColor:   C.offwhite,
    borderRadius:      5,
    paddingVertical:   10,
    paddingHorizontal: 12,
    borderTopWidth:    2,
    borderTopColor:    C.storno,
  },
  dateCellLabel: {
    fontSize:      7.5,
    fontFamily:    "Helvetica-Bold",
    color:         C.textSoft,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom:  4,
  },
  dateCellValue: {
    fontSize:   10,
    fontFamily: "Helvetica-Bold",
    color:      C.text,
  },

  // ── Tabla ─────────────────────────────────
  table: { marginBottom: 20 },
  tableHeader: {
    flexDirection:     "row",
    backgroundColor:   C.navyMid,
    paddingVertical:   8,
    paddingHorizontal: 10,
    borderRadius:      4,
    marginBottom:      2,
  },
  thCell: {
    fontSize:      7.5,
    fontFamily:    "Helvetica-Bold",
    color:         C.lime,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection:     "row",
    paddingVertical:   9,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRowAlt: { backgroundColor: C.offwhite },
  colPos:   { width: "6%" },
  colDesc:  { width: "52%" },
  colQty:   { width: "10%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colTotal: { width: "16%", textAlign: "right" },
  tdText:  { fontSize: 9.5, color: C.text },
  tdTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  tdLine:  { fontSize: 8.5, color: C.textSoft, marginTop: 2 },

  // ── Totales ───────────────────────────────
  totalsBlock: {
    alignSelf:    "flex-end",
    minWidth:     260,
    marginBottom: 20,
  },
  sumRow: {
    flexDirection:   "row",
    justifyContent:  "space-between",
    paddingVertical: 3,
  },
  sumLabel: { fontSize: 9.5, color: C.textSoft },
  sumValue: { fontSize: 9.5, color: C.textMid },
  sumDivider: {
    height:          1,
    backgroundColor: C.border,
    marginVertical:  8,
  },

  // Caja total — navy + lime (máximo contraste)
  totalBox: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    backgroundColor:   C.navy,
    borderRadius:      6,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  totalBoxStorno: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    backgroundColor:   C.storno,
    borderRadius:      6,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  totalLabel: {
    fontSize:   11,
    fontFamily: "Helvetica-Bold",
    color:      C.white,
  },
  totalValue: {
    fontSize:   15,
    fontFamily: "Helvetica-Bold",
    color:      C.lime,
  },
  totalValueStorno: {
    fontSize:   15,
    fontFamily: "Helvetica-Bold",
    color:      C.white,
  },

  // ── Texto legal ───────────────────────────
  legalText: {
    fontSize:     8.5,
    color:        C.textSoft,
    fontStyle:    "italic",
    marginBottom: 16,
    lineHeight:   1.5,
  },

  // ── Bloque pago ───────────────────────────
  payBlock: {
    backgroundColor:  C.payBg,
    borderRadius:     5,
    padding:          14,
    borderLeftWidth:  3,
    borderLeftColor:  C.lime,
    marginBottom:     16,
  },
  payBlockStorno: {
    backgroundColor:  C.payBg,
    borderRadius:     5,
    padding:          14,
    borderLeftWidth:  3,
    borderLeftColor:  C.storno,
    marginBottom:     16,
  },
  payTitle: {
    fontSize:      8,
    fontFamily:    "Helvetica-Bold",
    color:         C.navy,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom:  8,
  },
  payRow: { flexDirection: "row", marginBottom: 3 },
  payLabel: { fontSize: 9, color: C.textSoft, width: 52 },
  payValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.text, flex: 1 },
  payHint:  { fontSize: 8.5, color: C.textSoft, marginTop: 8, lineHeight: 1.5 },

  // ── Watermark STORNIERT ───────────────────
  watermark: {
    position:   "absolute",
    top:        280,
    left:       60,
    right:      60,
    alignItems: "center",
    transform:  "rotate(-35deg)",
  },
  watermarkText: {
    fontSize:   80,
    fontFamily: "Helvetica-Bold",
    color:      "#c0c0c0",
    opacity:    0.13,
    textAlign:  "center",
  },

  // ── Footer ────────────────────────────────
  footer: {
    position:       "absolute",
    bottom:         18,
    left:           PAD,
    right:          PAD,
    textAlign:      "center",
    fontSize:       7.5,
    color:          C.textSoft,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop:     7,
  },
});

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────

function snapshotName(s: IClientSnapshot): string {
  return s.companyName ?? s.contactName ?? "–";
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

interface InvoicePDFProps {
  invoice: IInvoiceLean;
  company: ICompanySettings;
}

export default function InvoicePDF({ invoice, company }: InvoicePDFProps) {
  const snapshot  = invoice.clientSnapshot;
  const isStorno  = Boolean(invoice.stornoOf);
  const cancelled = Boolean(invoice.stornoId);

  const footerLine = invoice.footerText?.trim()
    ? invoice.footerText
    : `${company.name} · ${company.street} · ${company.zip} ${company.city}`;

  const dateTag  = isStorno ? S.dateCellStorno : S.dateCell;
  const partyTag = isStorno ? S.partyTagStorno  : S.partyTag;

  return (
    <Document
      title={`${isStorno ? "Stornorechnung" : "Rechnung"} ${invoice.invoiceNumber}`}
      author={company.name}
      creator="Kleinunternehmer App"
    >
      <Page size="A4" style={S.page}>

        {/* ── Barra de color superior ── */}
        <View style={isStorno ? S.topBarStorno : S.topBar} />

        {/* ── Header ── */}
        <View style={S.header}>
          {/* Izquierda: empresa */}
          <View style={S.headerLeft}>
            <Text style={S.companyName}>{company.name}</Text>
            <Text style={S.companyMeta}>
              {company.street}{"  ·  "}{company.zip} {company.city}
            </Text>
            {company.email && (
              <Text style={S.companyMeta}>{company.email}</Text>
            )}
            {company.taxNumber && (
              <Text style={S.companyMeta}>St.-Nr. {company.taxNumber}</Text>
            )}
          </View>

          {/* Derecha: tipo + número */}
          <View style={S.headerRight}>
            <Text style={isStorno ? S.invoiceLabelStorno : S.invoiceLabel}>
              {isStorno ? "Stornorechnung" : "Rechnung"}
            </Text>
            <Text style={S.invoiceNumber}>{invoice.invoiceNumber}</Text>
            {invoice.issuedAt && (
              <Text style={S.invoiceDate}>
                {formatDateDE(new Date(invoice.issuedAt))}
              </Text>
            )}
          </View>
        </View>

        {/* ── Body ── */}
        <View style={S.body}>

          {/* ── Von / An ── */}
          <View style={S.partyRow}>
            <View style={S.partyCol}>
              <Text style={partyTag}>Von</Text>
              <Text style={S.partyName}>{company.name}</Text>
              <Text style={S.partyLine}>{company.street}</Text>
              <Text style={S.partyLine}>{company.zip} {company.city}</Text>
              <Text style={S.partyLine}>{company.country}</Text>
              {company.email     && <Text style={S.partyLine}>{company.email}</Text>}
              {company.phone     && <Text style={S.partyLine}>{company.phone}</Text>}
              {company.taxNumber && <Text style={S.partyLine}>St.-Nr.: {company.taxNumber}</Text>}
            </View>

            <View style={S.partySep} />

            <View style={S.partyCol}>
              <Text style={partyTag}>An</Text>
              {snapshot ? (
                <>
                  <Text style={S.partyName}>{snapshotName(snapshot)}</Text>
                  {snapshot.companyName && snapshot.contactName && (
                    <Text style={S.partyLine}>{snapshot.contactName}</Text>
                  )}
                  <Text style={S.partyLine}>{snapshot.street}</Text>
                  <Text style={S.partyLine}>{snapshot.zip} {snapshot.city}</Text>
                  <Text style={S.partyLine}>{snapshot.country}</Text>
                  {snapshot.email && <Text style={S.partyLine}>{snapshot.email}</Text>}
                </>
              ) : (
                <Text style={S.partyLine}>–</Text>
              )}
            </View>
          </View>

          {/* ── Fechas ── */}
          <View style={S.datesRow}>
            <View style={dateTag}>
              <Text style={S.dateCellLabel}>Rechnungsdatum</Text>
              <Text style={S.dateCellValue}>
                {invoice.issuedAt ? formatDateDE(new Date(invoice.issuedAt)) : "–"}
              </Text>
            </View>
            <View style={dateTag}>
              <Text style={S.dateCellLabel}>Leistungsdatum</Text>
              <Text style={S.dateCellValue}>
                {invoice.issuedAt ? formatDateDE(new Date(invoice.issuedAt)) : "–"}
              </Text>
            </View>
            <View style={dateTag}>
              <Text style={S.dateCellLabel}>Fällig bis</Text>
              <Text style={S.dateCellValue}>
                {invoice.dueAt ? formatDateDE(new Date(invoice.dueAt)) : "–"}
              </Text>
            </View>
          </View>

          {/* ── Tabla ── */}
          <View style={S.table}>
            <View style={S.tableHeader}>
              <Text style={[S.thCell, S.colPos]}>Pos.</Text>
              <Text style={[S.thCell, S.colDesc]}>Bezeichnung</Text>
              <Text style={[S.thCell, S.colQty]}>Menge</Text>
              <Text style={[S.thCell, S.colPrice]}>Einzelpreis</Text>
              <Text style={[S.thCell, S.colTotal]}>Betrag</Text>
            </View>

            {invoice.items.map((item, idx) => (
              <View
                key={idx}
                style={[S.tableRow, idx % 2 === 1 ? S.tableRowAlt : {}]}
              >
                <Text style={[S.tdText, S.colPos]}>{idx + 1}</Text>
                <View style={S.colDesc}>
                  <Text style={S.tdTitle}>{item.title}</Text>
                  {item.lines?.map((line, li) => (
                    <Text key={li} style={S.tdLine}>· {line}</Text>
                  ))}
                </View>
                <Text style={[S.tdText, S.colQty]}>{item.qty}</Text>
                <Text style={[S.tdText, S.colPrice]}>{formatEUR(item.unitPrice)}</Text>
                <Text style={[S.tdText, S.colTotal]}>
                  {formatEUR(safeRound2(item.qty * item.unitPrice))}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Totales ── */}
          <View style={S.totalsBlock}>
            <View style={S.sumRow}>
              <Text style={S.sumLabel}>Zwischensumme</Text>
              <Text style={S.sumValue}>{formatEUR(invoice.subtotal)}</Text>
            </View>
            <View style={S.sumRow}>
              <Text style={S.sumLabel}>MwSt. 0 % (§19 UStG)</Text>
              <Text style={S.sumValue}>{formatEUR(0)}</Text>
            </View>
            <View style={S.sumDivider} />
            <View style={isStorno ? S.totalBoxStorno : S.totalBox}>
              <Text style={S.totalLabel}>Gesamtbetrag</Text>
              <Text style={isStorno ? S.totalValueStorno : S.totalValue}>
                {formatEUR(invoice.total)}
              </Text>
            </View>
          </View>

          {/* ── §19 UStG ── */}
          <Text style={S.legalText}>{invoice.kleinunternehmerText}</Text>

          {/* ── Bloque pago ── */}
          {!isStorno && (company.iban || company.bic || company.bankName) && (
            <View style={S.payBlock}>
              <Text style={S.payTitle}>Zahlungsinformationen</Text>
              <View style={S.payRow}>
                <Text style={S.payLabel}>Empfänger:</Text>
                <Text style={S.payValue}>
                  {company.accountHolder || company.name}
                </Text>
              </View>
              {company.bankName && (
                <View style={S.payRow}>
                  <Text style={S.payLabel}>Bank:</Text>
                  <Text style={S.payValue}>{company.bankName}</Text>
                </View>
              )}
              {company.iban && (
                <View style={S.payRow}>
                  <Text style={S.payLabel}>IBAN:</Text>
                  <Text style={S.payValue}>{company.iban}</Text>
                </View>
              )}
              {company.bic && (
                <View style={S.payRow}>
                  <Text style={S.payLabel}>BIC:</Text>
                  <Text style={S.payValue}>{company.bic}</Text>
                </View>
              )}
              <Text style={S.payHint}>
                Bitte überweisen Sie {formatEUR(invoice.total)} unter Angabe der
                Rechnungsnummer {invoice.invoiceNumber} bis zum{" "}
                {invoice.dueAt ? formatDateDE(new Date(invoice.dueAt)) : "–"}.
              </Text>
            </View>
          )}

        </View>

        {/* ── Watermark STORNIERT ── */}
        {cancelled && (
          <View style={S.watermark}>
            <Text style={S.watermarkText}>STORNIERT</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={S.footer}>
          <Text>{footerLine}</Text>
        </View>

      </Page>
    </Document>
  );
}
