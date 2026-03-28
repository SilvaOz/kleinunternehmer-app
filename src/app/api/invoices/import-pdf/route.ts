import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Invoice from "@/models/Invoice";

// ─────────────────────────────────────────────
// pdf-parse: importar desde ruta directa para
// evitar el bug de Next.js con el test PDF
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  buf: Buffer
) => Promise<{ text: string }>;

// ─────────────────────────────────────────────
// Parser: extrae campos del texto del PDF
// Basado en el layout exacto de InvoicePDF.tsx
// ─────────────────────────────────────────────

interface ParsedInvoice {
  invoiceNumber: string;
  issuedAt: Date | null;
  total: number | null;
  clientName: string;
  filename: string;
}

function parseInvoiceText(text: string, filename: string): ParsedInvoice | null {
  // Normalizar: colapsar saltos de línea múltiples
  const t = text.replace(/\r/g, "").replace(/\n+/g, "\n").trim();

  // ── Rechnungsnummer ─────────────────────────
  const nrMatch = t.match(/Rechnungsnummer:\s*([^\n]+)/);
  const invoiceNumber = nrMatch?.[1]?.trim() ?? "";

  if (!invoiceNumber) return null;

  // ── Rechnungsdatum ──────────────────────────
  const dateMatch = t.match(/Rechnungsdatum:\s*(\d{2}\.\d{2}\.\d{4})/);
  let issuedAt: Date | null = null;
  if (dateMatch) {
    const [d, m, y] = dateMatch[1].split(".").map(Number);
    issuedAt = new Date(Date.UTC(y, m - 1, d));
  }

  // ── Gesamtbetrag ────────────────────────────
  // Formato en la factura: "Gesamtbetrag : 1.499,00 EUR"
  const totalMatch = t.match(/Gesamtbetrag\s*:\s*([\d.,]+)\s*EUR/);
  let total: number | null = null;
  if (totalMatch) {
    // Formato alemán: "1.499,00" → quitar punto de miles, reemplazar coma decimal
    const raw = totalMatch[1].replace(/\./g, "").replace(",", ".");
    const n = parseFloat(raw);
    if (!isNaN(n)) total = Math.round(n * 100) / 100;
  }

  // ── Cliente: texto entre "Empfänger" y "Rechnungsnummer" ──
  let clientName = "";
  const empfIdx  = t.indexOf("Empfänger");
  const nrIdx    = t.indexOf("Rechnungsnummer:");
  if (empfIdx !== -1 && nrIdx !== -1 && nrIdx > empfIdx) {
    const block = t.slice(empfIdx + "Empfänger".length, nrIdx).trim();
    // Primera línea no vacía = nombre del cliente
    const firstLine = block.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
    clientName = firstLine ?? "";
  }

  if (!total || total <= 0) return null;

  return { invoiceNumber, issuedAt, total, clientName: clientName || "Unbekannt", filename };
}

// ─────────────────────────────────────────────
// POST /api/invoices/import-pdf
// Body: multipart/form-data, campo "files" (1..N PDFs)
// Comportamiento: extrae datos, importa como "paid"
//   con paidAt = issuedAt (fecha de la factura)
// ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: "Nicht autorisiert" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const entries  = formData.getAll("files") as File[];

    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: "Keine Dateien übergeben" },
        { status: 400 }
      );
    }

    const pdfs = entries.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nur PDF-Dateien erlaubt" },
        { status: 400 }
      );
    }

    await connectDB();

    let imported = 0;
    const errors: string[] = [];

    for (const file of pdfs) {
      const buf = Buffer.from(await file.arrayBuffer());

      let parsed: ParsedInvoice | null = null;
      try {
        const { text } = await pdfParse(buf);
        parsed = parseInvoiceText(text, file.name);
      } catch {
        errors.push(`"${file.name}": PDF konnte nicht gelesen werden`);
        continue;
      }

      if (!parsed) {
        errors.push(`"${file.name}": Rechnungsnummer oder Betrag nicht gefunden`);
        continue;
      }

      // Comprobar duplicado
      const exists = await Invoice.exists({ ownerId, invoiceNumber: parsed.invoiceNumber });
      if (exists) {
        errors.push(`"${parsed.invoiceNumber}": bereits vorhanden – übersprungen`);
        continue;
      }

      try {
        await Invoice.create({
          ownerId,
          year:          0,
          sequence:      0,
          invoiceNumber: parsed.invoiceNumber,
          status:        "paid",
          issuedAt:      parsed.issuedAt ?? undefined,
          paidAt:        parsed.issuedAt ?? undefined,  // fecha de cobro = fecha factura
          locked:        true,
          clientSnapshot: {
            contactName: parsed.clientName,
            street:  "-",
            zip:     "-",
            city:    "-",
            country: "Deutschland",
          },
          items: [
            {
              title:     parsed.clientName,
              qty:       1,
              unitPrice: parsed.total!,
            },
          ],
          currency:             "EUR",
          kleinunternehmerText:
            process.env.INVOICE_KLEINUNTERNEHMER_TEXT ??
            "Gemäß §19 UStG wird keine Umsatzsteuer berechnet.",
        });
        imported++;
      } catch (err) {
        errors.push(`"${parsed.invoiceNumber}": ${(err as Error).message}`);
      }
    }

    return NextResponse.json(
      { success: true, imported, total: pdfs.length, errors },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/invoices/import-pdf]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
