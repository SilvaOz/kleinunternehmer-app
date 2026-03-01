// Re-exportar desde Counter para no duplicar lógica
export { formatInvoiceNumber } from "@/models/Counter";

// ─────────────────────────────────────────────
// Redondeo seguro a 2 decimales
// ─────────────────────────────────────────────

export function safeRound2(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ─────────────────────────────────────────────
// Formato monetario alemán
// Ejemplo: 1500 → "1.500,00 €"
// ─────────────────────────────────────────────

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style:                 "currency",
  currency:              "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEUR(amount: number): string {
  return eurFormatter.format(safeRound2(amount));
}

// ─────────────────────────────────────────────
// Formato fecha alemán
// Ejemplo: new Date("2026-02-28") → "28.02.2026"
// ─────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day:   "2-digit",
  month: "2-digit",
  year:  "numeric",
  timeZone: "Europe/Berlin",
});

export function formatDateDE(date: Date): string {
  return dateFormatter.format(date);
}

// ─────────────────────────────────────────────
// Parsear fecha DD.MM.YYYY → Date
// Ejemplo: "28.02.2026" → Date (UTC midnight)
// ─────────────────────────────────────────────

export function parseDateDE(dateStr: string): Date {
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    throw new Error(
      `Ungültiges Datumsformat: "${dateStr}". Erwartet: DD.MM.YYYY`
    );
  }
  const [, day, month, year] = match;
  // Construir como UTC para evitar drift de timezone
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  );
}

// ─────────────────────────────────────────────
// Formatear rango de fechas para reportes
// Ejemplo: "01.01.2026 – 31.12.2026"
// ─────────────────────────────────────────────

export function formatDateRangeDE(from: Date, to: Date): string {
  return `${formatDateDE(from)} – ${formatDateDE(to)}`;
}

// ─────────────────────────────────────────────
// Año fiscal actual
// ─────────────────────────────────────────────

export function currentFiscalYear(): number {
  return new Date().getFullYear();
}

// ─────────────────────────────────────────────
// Inicio y fin de año fiscal como Date (UTC)
// ─────────────────────────────────────────────

export function fiscalYearRange(year: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, 0, 1)),
    to:   new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}