/**
 * generateXRechnung.ts
 *
 * Generates a UBL 2.1 XML invoice conformant with:
 *   EN 16931-1:2017 (European e-invoicing standard)
 *   XRechnung 3.0 CIUS (urn:xoev-de:kosit:standard:xrechnung_3.0)
 *
 * For Kleinunternehmer (§19 UStG):
 *   - VAT rate is 0 %, tax category "E" (Exempt)
 *   - TaxTotal/TaxAmount is 0.00
 *   - §19 note is placed in cbc:Note
 */

import type { IInvoiceLean } from "@/services/pdf/InvoicePDF";
import type { ICompanySettings } from "@/models/User";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmt(amount: number): string {
  return amount.toFixed(2);
}

function fmtDate(date: Date | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function countryCode(name: string | undefined): string {
  if (!name) return "DE";
  const map: Record<string, string> = {
    deutschland: "DE", germany: "DE",
    österreich: "AT", austria: "AT",
    schweiz: "CH", switzerland: "CH",
    frankreich: "FR", france: "FR",
    niederlande: "NL", netherlands: "NL",
    belgien: "BE", belgium: "BE",
    italien: "IT", italy: "IT",
    spanien: "ES", spain: "ES",
    "vereinigtes königreich": "GB", "united kingdom": "GB", "great britain": "GB",
    usa: "US", "united states": "US", "vereinigte staaten": "US",
    luxemburg: "LU", luxembourg: "LU",
    dänemark: "DK", denmark: "DK",
    schweden: "SE", sweden: "SE",
    norwegen: "NO", norway: "NO",
    polen: "PL", poland: "PL",
    tschechien: "CZ", "czech republic": "CZ",
  };
  return map[name.toLowerCase()] ?? "DE";
}

// ─────────────────────────────────────────────
// Main generator
// ─────────────────────────────────────────────

export function generateXRechnung(
  invoice: IInvoiceLean,
  company: ICompanySettings
): string {
  const cs = invoice.clientSnapshot!;
  const currency = invoice.currency ?? "EUR";

  const lineExtension = fmt(invoice.subtotal ?? invoice.total);
  const payableAmount = fmt(invoice.total);

  const issuedDate = fmtDate(invoice.issuedAt);
  const dueDate    = fmtDate(invoice.dueAt);

  const sellerCountry = countryCode(company.country);
  const buyerCountry  = countryCode(cs.country);
  const buyerName     = cs.companyName ?? cs.contactName ?? "Käufer";

  // BT-10: BuyerReference — required by XRechnung CIUS (BR-DE-15)
  // Falls back to invoice number if the buyer didn't provide a reference.
  const buyerReference = esc(invoice.buyerReference ?? invoice.invoiceNumber);

  const paymentMeansCode = company.iban ? "30" : "1";

  // ── Invoice lines ──────────────────────────
  const invoiceLines = invoice.items
    .map((item, idx) => {
      const lineTotal = Math.round(item.qty * item.unitPrice * 100) / 100;
      const description = item.lines?.join(" | ") ?? "";
      return `  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${item.qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${fmt(lineTotal)}</cbc:LineExtensionAmount>
    <cac:Item>
      ${description ? `<cbc:Description>${esc(description)}</cbc:Description>` : ""}
      <cbc:Name>${esc(item.title)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>E</cbc:ID>
        <cbc:Percent>0</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${fmt(item.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join("\n");

  // ── XML ────────────────────────────────────
  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice
  xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <!-- BT-24: Specification identifier -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <!-- BT-23: Business process type -->
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>

  <!-- BT-1: Invoice number -->
  <cbc:ID>${esc(invoice.invoiceNumber)}</cbc:ID>
  <!-- BT-2: Invoice issue date -->
  <cbc:IssueDate>${issuedDate}</cbc:IssueDate>
  ${dueDate ? `<!-- BT-9: Payment due date -->\n  <cbc:DueDate>${dueDate}</cbc:DueDate>` : ""}
  <!-- BT-3: Invoice type code — 380 = Commercial invoice -->
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <!-- BT-22: Note — §19 UStG exemption statement -->
  <cbc:Note>${esc(invoice.kleinunternehmerText)}</cbc:Note>
  <!-- BT-5: Invoice currency code -->
  <cbc:DocumentCurrencyCode>${esc(currency)}</cbc:DocumentCurrencyCode>
  <!--
    BT-10: Buyer reference — required by XRechnung CIUS (BR-DE-15).
    For German public sector invoices this is the Leitweg-ID.
    For B2B it is the buyer's order/reference number.
  -->
  <cbc:BuyerReference>${buyerReference}</cbc:BuyerReference>

  <!-- ═══════════════════════════════════════════
       BG-4: Seller
       ═══════════════════════════════════════════ -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <!--
        BT-34: Seller electronic address (PEPPOL-EN16931-R020).
        schemeID "EM" = Electronic Mail.
      -->
      ${company.email ? `<cbc:EndpointID schemeID="EM">${esc(company.email)}</cbc:EndpointID>` : ""}
      <!-- BT-27: Seller name -->
      <cac:PartyName>
        <cbc:Name>${esc(company.name)}</cbc:Name>
      </cac:PartyName>
      <!-- BG-5: Seller postal address -->
      <cac:PostalAddress>
        <cbc:StreetName>${esc(company.street)}</cbc:StreetName>
        <cbc:CityName>${esc(company.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(company.zip)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${sellerCountry}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${
        company.taxNumber
          ? `<!-- BT-32: Seller tax registration (Steuernummer, scheme FC) -->
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(company.taxNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ""
      }
      <!--
        BT-27 / BT-30: Legal entity.
        CompanyID = BT-30 (Seller legal registration identifier) — satisfies BR-CO-26.
      -->
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(company.name)}</cbc:RegistrationName>
        ${company.taxNumber ? `<cbc:CompanyID>${esc(company.taxNumber)}</cbc:CompanyID>` : ""}
      </cac:PartyLegalEntity>
      <!-- BG-6: Seller contact — BT-41 Name is required (BR-DE-5) -->
      <cac:Contact>
        <!-- BT-41: Seller contact point -->
        <cbc:Name>${esc(company.name)}</cbc:Name>
        ${company.phone ? `<!-- BT-42 -->\n        <cbc:Telephone>${esc(company.phone)}</cbc:Telephone>` : ""}
        ${company.email ? `<!-- BT-43 -->\n        <cbc:ElectronicMail>${esc(company.email)}</cbc:ElectronicMail>` : ""}
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- ═══════════════════════════════════════════
       BG-7: Buyer
       ═══════════════════════════════════════════ -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <!--
        BT-49: Buyer electronic address (PEPPOL-EN16931-R010).
        schemeID "EM" = Electronic Mail.
      -->
      ${cs.email ? `<cbc:EndpointID schemeID="EM">${esc(cs.email)}</cbc:EndpointID>` : ""}
      <!-- BT-44: Buyer name -->
      <cac:PartyName>
        <cbc:Name>${esc(buyerName)}</cbc:Name>
      </cac:PartyName>
      <!-- BG-8: Buyer postal address -->
      <cac:PostalAddress>
        <cbc:StreetName>${esc(cs.street)}</cbc:StreetName>
        <cbc:CityName>${esc(cs.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(cs.zip)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${buyerCountry}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(buyerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      ${
        cs.email
          ? `<cac:Contact>
        <cbc:ElectronicMail>${esc(cs.email)}</cbc:ElectronicMail>
      </cac:Contact>`
          : ""
      }
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- ═══════════════════════════════════════════
       BG-16: Payment instructions
       ═══════════════════════════════════════════ -->
  <cac:PaymentMeans>
    <!-- BT-81: 30 = Credit transfer (SEPA), 1 = Undefined -->
    <cbc:PaymentMeansCode>${paymentMeansCode}</cbc:PaymentMeansCode>
    ${
      company.iban
        ? `<cac:PayeeFinancialAccount>
      <!-- BT-84: IBAN -->
      <cbc:ID>${esc(company.iban)}</cbc:ID>
      ${company.bankName ? `<cbc:Name>${esc(company.bankName)}</cbc:Name>` : ""}
      ${company.bic
        ? `<cac:FinancialInstitutionBranch>
        <!-- BT-86: BIC -->
        <cbc:ID>${esc(company.bic)}</cbc:ID>
      </cac:FinancialInstitutionBranch>`
        : ""}
    </cac:PayeeFinancialAccount>`
        : ""
    }
  </cac:PaymentMeans>

  <!-- ═══════════════════════════════════════════
       BG-23: VAT breakdown — 0 % (§19 UStG)
       ═══════════════════════════════════════════ -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">0.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${lineExtension}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <!-- BT-118: E = Exempt from tax -->
        <cbc:ID>E</cbc:ID>
        <cbc:Percent>0</cbc:Percent>
        <cbc:TaxExemptionReason>Steuerbefreiung gemäß §19 UStG (Kleinunternehmer)</cbc:TaxExemptionReason>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- ═══════════════════════════════════════════
       BG-22: Document totals
       ═══════════════════════════════════════════ -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${lineExtension}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${lineExtension}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${payableAmount}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${payableAmount}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- ═══════════════════════════════════════════
       BG-25: Invoice lines
       ═══════════════════════════════════════════ -->
${invoiceLines}

</ubl:Invoice>`;
}
