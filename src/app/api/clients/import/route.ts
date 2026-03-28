import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Client from "@/models/Client";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const COUNTRY_MAP: Record<string, string> = {
  DE: "Deutschland",
  CH: "Schweiz",
  AT: "Österreich",
  FR: "Frankreich",
  NL: "Niederlande",
  ES: "Spanien",
  IT: "Italien",
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

// ─────────────────────────────────────────────
// POST /api/clients/import
// Body: multipart/form-data, campo "file" (.csv)
// Columnas esperadas: nombre, direccion, ciudad,
//   codigo_postal, pais, telefono, email, web, notas
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
        { success: false, error: "CSV leer oder keine Datenzeilen gefunden" },
        { status: 400 }
      );
    }

    await connectDB();

    let imported = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const name = row["nombre"] ?? "";
      if (!name) {
        errors.push("Zeile übersprungen: kein Name");
        continue;
      }

      const countryCode = (row["pais"] ?? "DE").toUpperCase();
      const country = COUNTRY_MAP[countryCode] ?? row["pais"] ?? "Deutschland";

      // Combinar web y notas en un solo campo
      const web = row["web"] ?? "";
      const notas = row["notas"] ?? "";
      const notesParts = [
        notas ? notas : null,
        web ? `Web: ${web}` : null,
      ].filter(Boolean);
      const notes = notesParts.length > 0 ? notesParts.join(" | ") : undefined;

      try {
        await Client.create({
          ownerId,
          contactName: name,
          street: row["direccion"] || "-",
          zip: row["codigo_postal"] || "-",
          city: row["ciudad"] || "-",
          country,
          email: row["email"] || undefined,
          phone: row["telefono"] || undefined,
          notes,
          isActive: true,
        });
        imported++;
      } catch (err) {
        errors.push(`"${name}": ${(err as Error).message}`);
      }
    }

    return NextResponse.json(
      { success: true, imported, total: rows.length, errors },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/clients/import]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
