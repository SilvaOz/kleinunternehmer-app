import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import { safeRound2, formatDateDE, formatEUR } from "@/lib/formatters";
import { getClientDisplayName } from "@/models/Client";

// ─────────────────────────────────────────────
// CSV helpers
// ─────────────────────────────────────────────

function escapeCell(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Si contiene coma, comilla o salto de línea → envolver en comillas
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const separator = ";"; // ← Excel Alemania
  const lines: string[] = [];

  lines.push(headers.map(escapeCell).join(separator));

  for (const row of rows) {
    lines.push(row.map(escapeCell).join(separator));
  }

  return lines.join("\n");
}

function csvResponse(csv: string, filename: string): NextResponse {
  const BOM = "\uFEFF"; // ← Excel necesita esto

  return new NextResponse(BOM + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ─────────────────────────────────────────────
// GET /api/reports/export?year=YYYY&type=eur|invoices|expenses
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: "Nicht autorisiert" },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year")?.trim();
    const year      = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    const type      = searchParams.get("type")?.trim() ?? "eur";

    if (isNaN(year)) {
      return NextResponse.json(
        { success: false, error: "Ungültiges Jahr" },
        { status: 400 }
      );
    }

    if (!["eur", "invoices", "expenses"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Ungültiger type. Erlaubt: eur, invoices, expenses" },
        { status: 400 }
      );
    }

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const from = new Date(Date.UTC(year, 0, 1));
    const to   = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    // ─────────────────────────────────────────
    // type = "invoices"
    // ─────────────────────────────────────────

    if (type === "invoices") {
      const invoices = await Invoice.find({
        ownerId: ownerObjectId,
        status:  "paid",
        paidAt:  { $gte: from, $lte: to },
      })
        .sort({ paidAt: 1 })
        .lean();

      const headers = [
        "paidAt",
        "invoiceNumber",
        "clientName",
        "total",
        "currency",
      ];

      const rows = invoices.map((inv) => {
        const clientName = inv.clientSnapshot
          ? getClientDisplayName(inv.clientSnapshot as { companyName?: string; contactName?: string })
          : "";

        return [
          inv.paidAt ? formatDateDE(inv.paidAt) : "",
          inv.invoiceNumber,
          clientName,
          formatEUR(inv.total),
          inv.currency,
        ];
      });

      return csvResponse(
        buildCSV(headers, rows),
        `rechnungen-bezahlt-${year}.csv`
      );
    }

    // ─────────────────────────────────────────
    // type = "expenses"
    // ─────────────────────────────────────────

    if (type === "expenses") {
      const expenses = await Expense.find({
        ownerId: ownerObjectId,
        paid:    true,
        paidAt:  { $gte: from, $lte: to },
      })
        .sort({ paidAt: 1 })
        .lean();

      const headers = [
        "paidAt",
        "date",
        "vendor",
        "description",
        "category",
        "amountGross",
        "businessUsePct",
        "amountBusiness",
      ];

      const rows = expenses.map((exp) => {
        const amountBusiness = safeRound2(
          exp.amountGross * (exp.businessUsePct / 100)
        );
        return [
          exp.paidAt ? formatDateDE(exp.paidAt) : "",
          formatDateDE(exp.date),
          exp.vendor ?? "",
          exp.description,
          exp.category,
          safeRound2(exp.amountGross),
          exp.businessUsePct,
          amountBusiness,
        ];
      });

      return csvResponse(
        buildCSV(headers, rows),
        `ausgaben-${year}.csv`
      );
    }

    // ─────────────────────────────────────────
    // type = "eur" (default)
    // resumen mensual: incomePaid, expensesBusinessPaid, profit
    // ─────────────────────────────────────────

    const incomeAgg = await Invoice.aggregate([
      {
        $match: {
          ownerId: ownerObjectId,
          status:  "paid",
          paidAt:  { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id:   { $month: "$paidAt" },
          total: { $sum: "$total" },
        },
      },
    ]);

    const expenseAgg = await Expense.aggregate([
      {
        $match: {
          ownerId: ownerObjectId,
          paid:    true,
          paidAt:  { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: { $month: "$paidAt" },
          total: {
            $sum: {
              $multiply: [
                "$amountGross",
                { $divide: ["$businessUsePct", 100] },
              ],
            },
          },
        },
      },
    ]);

    const incomeByMonth  = new Map<number, number>();
    const expenseByMonth = new Map<number, number>();

    for (const row of incomeAgg) {
      incomeByMonth.set(row._id as number, safeRound2(row.total as number));
    }
    for (const row of expenseAgg) {
      expenseByMonth.set(row._id as number, safeRound2(row.total as number));
    }

    const headers = [
      "month",
      "incomePaid",
      "expensesBusinessPaid",
      "profit",
    ];

    const rows: (string | number)[][] = [];
    let totalIncome   = 0;
    let totalExpenses = 0;

    for (let m = 1; m <= 12; m++) {
      const incomePaid           = incomeByMonth.get(m)  ?? 0;
      const expensesBusinessPaid = expenseByMonth.get(m) ?? 0;
      const profit               = safeRound2(incomePaid - expensesBusinessPaid);

      totalIncome   += incomePaid;
      totalExpenses += expensesBusinessPaid;

      rows.push([m, incomePaid, expensesBusinessPaid, profit]);
    }

    // Fila de totales
    rows.push([
      "GESAMT",
      safeRound2(totalIncome),
      safeRound2(totalExpenses),
      safeRound2(totalIncome - totalExpenses),
    ]);

    return csvResponse(
      buildCSV(headers, rows),
      `EÜR-${year}.csv`
    );
  } catch (error) {
    console.error("[GET /api/reports/export]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}