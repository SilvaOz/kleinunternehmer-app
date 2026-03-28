import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Invoice from "@/models/Invoice";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

/** Acepta DD.MM.YYYY o YYYY-MM-DD */
function parseDate(s: string): Date | null {
  if (!s) return null;
  s = s.trim();
  // DD.MM.YYYY
  const deMatch = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (deMatch) {
    return new Date(Date.UTC(
      parseInt(deMatch[3]),
      parseInt(deMatch[2]) - 1,
      parseInt(deMatch[1])
    ));
  }
  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(Date.UTC(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3])
    ));
  }
  return null;
}

/** Acepta 599.00 o 599,00 */
function parseAmount(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────
// POST /api/invoices/import
// Body: multipart/form-data, campo "file" (.csv)
//
// Columnas CSV:
//   rechnungsnummer  – obligatorio, único por usuario
//   kunde            – obligatorio (nombre del cliente)
//   betrag           – obligatorio (ej: 599.00 o 599,00)
//   rechnungsdatum   – opcional  (DD.MM.YYYY o YYYY-MM-DD)
//   zahlungsdatum    – obligatorio si status=paid
//   status           – "paid" | "issued"  (default: "paid")
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
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Keine Datei übergeben" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { success: false, error: "Nur CSV-Dateien erlaubt" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "CSV leer oder keine Datenzeilen" },
        { status: 400 }
      );
    }

    await connectDB();

    let imported = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const nr     = row["rechnungsnummer"] ?? "";
      const kunde  = row["kunde"] ?? "";
      const status = (row["status"]?.trim().toLowerCase() || "paid") as "paid" | "issued";

      // ── Validaciones básicas ──────────────────
      if (!nr)    { errors.push(`Zeile übersprungen: rechnungsnummer fehlt`); continue; }
      if (!kunde) { errors.push(`"${nr}": kunde fehlt`); continue; }

      const betrag = parseAmount(row["betrag"] ?? "");
      if (betrag === null || betrag <= 0) {
        errors.push(`"${nr}": betrag fehlt oder ungültig`);
        continue;
      }

      if (!["paid", "issued"].includes(status)) {
        errors.push(`"${nr}": status muss "paid" oder "issued" sein`);
        continue;
      }

      const issuedAt = parseDate(row["rechnungsdatum"] ?? "");
      const paidAt   = parseDate(row["zahlungsdatum"] ?? "");

      if (status === "paid" && !paidAt) {
        errors.push(`"${nr}": zahlungsdatum fehlt (status=paid erfordert ein Zahlungsdatum)`);
        continue;
      }

      // ── Comprobar duplicado ───────────────────
      const exists = await Invoice.exists({ ownerId, invoiceNumber: nr });
      if (exists) {
        errors.push(`"${nr}": Rechnungsnummer bereits vorhanden – übersprungen`);
        continue;
      }

      // ── Crear factura histórica ───────────────
      // year=0 / sequence=0 para no interferir con el contador real
      try {
        await Invoice.create({
          ownerId,
          year:          0,
          sequence:      0,
          invoiceNumber: nr,
          status,
          issuedAt:  issuedAt ?? undefined,
          paidAt:    paidAt   ?? undefined,
          locked:    true,
          clientSnapshot: {
            contactName: kunde,
            street:  "-",
            zip:     "-",
            city:    "-",
            country: "Deutschland",
          },
          items: [
            {
              title:     kunde,
              qty:       1,
              unitPrice: betrag,
            },
          ],
          currency:              "EUR",
          kleinunternehmerText:
            process.env.INVOICE_KLEINUNTERNEHMER_TEXT ??
            "Gemäß §19 UStG wird keine Umsatzsteuer berechnet.",
        });
        imported++;
      } catch (err) {
        errors.push(`"${nr}": ${(err as Error).message}`);
      }
    }

    return NextResponse.json(
      { success: true, imported, total: rows.length, errors },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/invoices/import]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
