import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
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
  black:    "#111111",
  yellow:   "#F5C800",
  white:    "#ffffff",
  offwhite: "#fafafa",
  text:     "#1a1b1e",
  textMid:  "#4a4d5a",
  textSoft: "#888888",
  border:   "#cccccc",
  storno:   "#dc2626",
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

  // ── Hero / Briefkopf ─────────────────────────────────────────────────
  hero: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   C.white,
    paddingHorizontal: PAD,
    paddingTop:        26,
    paddingBottom:     26,
  },
  heroStorno: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#fff5f5",
    paddingHorizontal: PAD,
    paddingTop:        26,
    paddingBottom:     26,
  },

  // Barra de acento bajo el hero
  heroAccent:       { height: 3, backgroundColor: C.yellow },
  heroAccentStorno: { height: 3, backgroundColor: C.storno },

  // Logo — sin tarjeta, directo sobre fondo blanco (logo transparente)
  heroLogoWrap: {
    width:          300,
    paddingRight:   32,
    justifyContent: "center",
  },
  heroLogo: {
    width:      265,
    height:     150,
    objectFit:  "contain",
    alignSelf:  "flex-start",
  },
  heroFallback: {
    fontSize:   22,
    fontFamily: "Helvetica-Bold",
    color:      C.black,
  },

  // Línea vertical de acento entre logo e info
  heroSeparator: {
    width:           1,
    backgroundColor: "#dddddd",
    marginRight:     28,
    alignSelf:       "stretch",
  },
  heroSeparatorStorno: {
    width:           1,
    backgroundColor: C.storno,
    marginRight:     28,
    alignSelf:       "stretch",
  },

  // Columna derecha del hero
  heroRight: {
    flex:        1,
    alignItems:  "flex-start",
  },
  heroTag: {
    fontSize:          8,
    fontFamily:        "Helvetica-Bold",
    color:             C.black,
    backgroundColor:   C.yellow,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      2,
    alignSelf:         "flex-start",
    marginBottom:      10,
    letterSpacing:     0.8,
  },
  heroTagStorno: {
    fontSize:          8,
    fontFamily:        "Helvetica-Bold",
    color:             C.white,
    backgroundColor:   C.storno,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      2,
    alignSelf:         "flex-start",
    marginBottom:      10,
    letterSpacing:     0.8,
  },
  heroCompanyName: {
    fontSize:     16,
    fontFamily:   "Helvetica-Bold",
    color:        C.black,
    marginBottom: 5,
  },
  heroMeta: {
    fontSize:   9.5,
    color:      C.textMid,
    lineHeight: 1.75,
    textAlign:  "left",
  },

  // ── Body ─────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: PAD,
    paddingTop:        22,
    paddingBottom:     80,
  },

  // ── Sección superior: Empfänger (izq) + Metadatos (der) ──────────────
  topSection: {
    flexDirection: "row",
    alignItems:    "flex-start",
    marginBottom:  28,
  },

  recipientBlock: {
    flex:            1,
    marginRight:     24,
    borderLeftWidth: 3,
    borderLeftColor: "#aaaaaa",
    paddingLeft:     10,
  },
  recipientBlockStorno: {
    flex:            1,
    marginRight:     24,
    borderLeftWidth: 3,
    borderLeftColor: C.storno,
    paddingLeft:     10,
  },
  recipientLabel: {
    fontSize:      8,
    color:         C.textSoft,
    marginBottom:  5,
    letterSpacing: 0.6,
  },
  recipientName: {
    fontSize:     11,
    fontFamily:   "Helvetica-Bold",
    color:        C.text,
    marginBottom: 3,
  },
  recipientLine: {
    fontSize:   9.5,
    color:      C.textMid,
    lineHeight: 1.6,
  },

  // ── Metadatos (columna derecha) ───────────────────────────────────────
  metaBlock: {
    width:     210,
    alignSelf: "flex-start",
  },
  metaRow: {
    flexDirection: "row",
    marginBottom:  5,
  },
  metaLabel: {
    fontSize: 9.5,
    color:    C.textSoft,
    width:    120,
  },
  metaValue: {
    fontSize:   9.5,
    fontFamily: "Helvetica-Bold",
    color:      C.text,
    flex:       1,
  },
  stornoTag: {
    fontSize:          9,
    fontFamily:        "Helvetica-Bold",
    color:             C.white,
    backgroundColor:   C.storno,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      3,
    alignSelf:         "flex-start",
    marginBottom:      10,
  },

  // ── Título sección ────────────────────────────────────────────────────
  sectionTitle: {
    fontSize:      11,
    fontFamily:    "Helvetica-Bold",
    color:         C.black,
    marginBottom:  0,
    letterSpacing: 0.3,
  },

  // ── Tabla ─────────────────────────────────────────────────────────────
  table: { marginBottom: 0 },
  tableHeader: {
    flexDirection:     "row",
    backgroundColor:   "#2d2d2d",
    paddingVertical:   8,
    paddingHorizontal: 10,
    marginTop:         8,
  },
  tableHeaderStorno: {
    flexDirection:     "row",
    backgroundColor:   C.storno,
    paddingVertical:   8,
    paddingHorizontal: 10,
    borderWidth:       1,
    borderColor:       C.storno,
    marginTop:         8,
  },
  thCell:       { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.white },
  thCellStorno: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.white },
  tableRow: {
    flexDirection:     "row",
    paddingVertical:   9,
    paddingHorizontal: 10,
    borderLeftWidth:   1,
    borderRightWidth:  1,
    borderBottomWidth: 0.5,
    borderLeftColor:   C.black,
    borderRightColor:  C.black,
    borderBottomColor: C.border,
  },
  tableRowAlt: { backgroundColor: C.offwhite },
  tableFooterRow: {
    flexDirection:     "row",
    paddingVertical:   8,
    paddingHorizontal: 10,
    borderWidth:       1,
    borderColor:       C.black,
    backgroundColor:   C.offwhite,
  },
  colPos:   { width: "6%" },
  colDesc:  { width: "52%" },
  colQty:   { width: "10%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colTotal: { width: "16%", textAlign: "right" },
  tdText:   { fontSize: 9.5, color: C.text },
  tdTitle:  { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  tdLine:   { fontSize: 8.5, color: C.textSoft, marginTop: 2 },
  tdFooter: { fontSize: 10,  fontFamily: "Helvetica-Bold", color: C.black },

  // ── Total en caja oscura ──────────────────────────────────────────────
  totalBlock: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    backgroundColor:   "#2d2d2d",
    paddingHorizontal: 14,
    paddingVertical:   11,
    marginTop:         16,
    marginBottom:      18,
    borderRadius:      3,
  },
  totalLabel: {
    fontSize:   12,
    fontFamily: "Helvetica-Bold",
    color:      C.white,
  },
  totalAmount: {
    fontSize:   16,
    fontFamily: "Helvetica-Bold",
    color:      C.white,
  },

  // ── §19 UStG ─────────────────────────────────────────────────────────
  legalText: {
    fontSize:     9,
    color:        C.textMid,
    marginBottom: 16,
    lineHeight:   1.5,
  },

  // ── Bloque de pago ────────────────────────────────────────────────────
  payBlock: {
    marginBottom:    20,
    borderLeftWidth: 3,
    borderLeftColor: C.border,
    paddingLeft:     10,
  },
  payHint: {
    fontSize:     9.5,
    color:        C.textMid,
    lineHeight:   1.6,
    marginBottom: 8,
  },
  payRow: {
    flexDirection: "row",
    marginBottom:  4,
  },
  payLabel: { fontSize: 9.5, color: C.textSoft, width: 110 },
  payValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text, flex: 1 },

  // ── Cierre ────────────────────────────────────────────────────────────
  closingText: {
    fontSize:     9.5,
    color:        C.textMid,
    lineHeight:   1.6,
    marginBottom: 4,
  },
  closingName: {
    fontSize:   10,
    fontFamily: "Helvetica-Bold",
    color:      C.black,
  },

  // ── Watermark STORNIERT ───────────────────────────────────────────────
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

  // ── Footer ────────────────────────────────────────────────────────────
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

  return (
    <Document
      title={`${isStorno ? "Stornorechnung" : "Rechnung"} ${invoice.invoiceNumber}`}
      author={company.name}
      creator="Kleinunternehmer App"
    >
      <Page size="A4" style={S.page}>

        {/* ── Hero / Briefkopf ── */}
        <View style={isStorno ? S.heroStorno : S.hero}>

          {/* Logo directo sobre blanco — sin tarjeta gris */}
          <View style={S.heroLogoWrap}>
            {company.logoUrl ? (
              <Image src={company.logoUrl} style={S.heroLogo} />
            ) : (
              <Text style={S.heroFallback}>{company.name}</Text>
            )}
          </View>

          {/* Línea vertical de acento */}
          <View style={isStorno ? S.heroSeparatorStorno : S.heroSeparator} />

          {/* Datos empresa */}
          <View style={S.heroRight}>
            <Text style={isStorno ? S.heroTagStorno : S.heroTag}>
              {isStorno ? "STORNORECHNUNG" : "RECHNUNG"}
            </Text>
            <Text style={S.heroCompanyName}>{company.name}</Text>
            <Text style={S.heroMeta}>{company.street}</Text>
            <Text style={S.heroMeta}>{company.zip} {company.city}</Text>
            {company.taxNumber && (
              <Text style={S.heroMeta}>Steuernummer: {company.taxNumber}</Text>
            )}
            {company.iban && (
              <Text style={S.heroMeta}>IBAN: {company.iban}</Text>
            )}
            {company.bic && (
              <Text style={S.heroMeta}>BIC: {company.bic}</Text>
            )}
          </View>
        </View>

        {/* Barra de acento bajo el hero */}
        <View style={isStorno ? S.heroAccentStorno : S.heroAccent} />

        {/* ── Body ── */}
        <View style={S.body}>

          {/* ── Sección superior: Empfänger (izq) + Metadatos (der) ── */}
          <View style={S.topSection}>

            {/* Empfänger con acento izquierdo */}
            <View style={isStorno ? S.recipientBlockStorno : S.recipientBlock}>
              <Text style={S.recipientLabel}>EMPFÄNGER</Text>
              {snapshot ? (
                <>
                  <Text style={S.recipientName}>{snapshotName(snapshot)}</Text>
                  {snapshot.companyName && snapshot.contactName && (
                    <Text style={S.recipientLine}>{snapshot.contactName}</Text>
                  )}
                  <Text style={S.recipientLine}>{snapshot.street}</Text>
                  <Text style={S.recipientLine}>{snapshot.zip} {snapshot.city}</Text>
                  {snapshot.country && (
                    <Text style={S.recipientLine}>{snapshot.country}</Text>
                  )}
                </>
              ) : (
                <Text style={S.recipientLine}>–</Text>
              )}
            </View>

            {/* Metadatos: número, fecha, vencimiento */}
            <View style={S.metaBlock}>
              {isStorno && (
                <Text style={S.stornoTag}>STORNORECHNUNG</Text>
              )}
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Rechnungsnummer:</Text>
                <Text style={S.metaValue}>{invoice.invoiceNumber}</Text>
              </View>
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Rechnungsdatum:</Text>
                <Text style={S.metaValue}>
                  {invoice.issuedAt ? formatDateDE(new Date(invoice.issuedAt)) : "–"}
                </Text>
              </View>
              {invoice.dueAt && (
                <View style={S.metaRow}>
                  <Text style={S.metaLabel}>Fällig bis:</Text>
                  <Text style={S.metaValue}>
                    {formatDateDE(new Date(invoice.dueAt))}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Título + Tabla ── */}
          <Text style={S.sectionTitle}>Erbrachte Leistungen</Text>

          <View style={S.table}>
            <View style={isStorno ? S.tableHeaderStorno : S.tableHeader}>
              <Text style={[isStorno ? S.thCellStorno : S.thCell, S.colPos]}>Pos.</Text>
              <Text style={[isStorno ? S.thCellStorno : S.thCell, S.colDesc]}>Leistung</Text>
              <Text style={[isStorno ? S.thCellStorno : S.thCell, S.colQty]}>Menge</Text>
              <Text style={[isStorno ? S.thCellStorno : S.thCell, S.colPrice]}>Einzelpreis</Text>
              <Text style={[isStorno ? S.thCellStorno : S.thCell, S.colTotal]}>Betrag</Text>
            </View>

            {invoice.items.map((item, idx) => (
              <View key={idx} style={[S.tableRow, idx % 2 === 1 ? S.tableRowAlt : {}]}>
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

            <View style={S.tableFooterRow}>
              <Text style={[S.tdFooter, S.colPos]}></Text>
              <Text style={[S.tdFooter, S.colDesc]}>Gesamt</Text>
              <Text style={[S.tdFooter, S.colQty]}></Text>
              <Text style={[S.tdFooter, S.colPrice]}></Text>
              <Text style={[S.tdFooter, S.colTotal]}>{formatEUR(invoice.total)}</Text>
            </View>
          </View>

          {/* ── Gesamtbetrag en caja amarilla ── */}
          <View style={S.totalBlock}>
            <Text style={S.totalLabel}>Gesamtbetrag</Text>
            <Text style={S.totalAmount}>{formatEUR(invoice.total)} EUR</Text>
          </View>

          {/* ── §19 UStG ── */}
          <Text style={S.legalText}>{invoice.kleinunternehmerText}</Text>

          {/* ── Información de pago ── */}
          {!isStorno && (company.iban || company.bic) && (
            <View style={S.payBlock}>
              <Text style={S.payHint}>
                Bitte überweisen Sie den Gesamtbetrag auf folgendes Konto:
              </Text>
              {(company.accountHolder || company.name) && (
                <View style={S.payRow}>
                  <Text style={S.payLabel}>Kontoinhaber:</Text>
                  <Text style={S.payValue}>{company.accountHolder || company.name}</Text>
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
            </View>
          )}

          {/* ── Cierre ── */}
          <Text style={S.closingText}>
            Herzlichen Dank für Ihr Vertrauen und die Zusammenarbeit!
          </Text>
          <Text style={S.closingName}>{company.accountHolder || company.name}</Text>

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
