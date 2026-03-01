import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import { safeRound2 } from "@/lib/formatters";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface MonthlyEntry {
  month: number;
  incomePaid: number;
  expensesBusinessPaid: number;
  profit: number;
}

interface SummaryResponse {
  success: true;
  year: number;
  totals: {
    incomePaid: number;
    expensesBusinessPaid: number;
    profit: number;
    outstanding: number;
  };
  monthly: MonthlyEntry[];
}

// ─────────────────────────────────────────────
// GET /api/reports/summary?year=YYYY
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

    if (isNaN(year)) {
      return NextResponse.json(
        { success: false, error: "Ungültiges Jahr" },
        { status: 400 }
      );
    }

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const from = new Date(Date.UTC(year, 0, 1));
    const to   = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    // ── 1) Ingresos pagados (por mes) ─────────
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
      { $sort: { _id: 1 } },
    ]);

    // ── 2) Gastos ajustados pagados (por mes) ─
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
      { $sort: { _id: 1 } },
    ]);

    // ── 3) Facturas pendientes (outstanding) ──
    const outstandingAgg = await Invoice.aggregate([
      {
        $match: {
          ownerId: ownerObjectId,
          status:  "issued",
        },
      },
      {
        $group: {
          _id:   null,
          total: { $sum: "$total" },
        },
      },
    ]);

    // ── Construir mapa por mes ────────────────
    const incomeByMonth   = new Map<number, number>();
    const expenseByMonth  = new Map<number, number>();

    for (const row of incomeAgg) {
      incomeByMonth.set(row._id as number, safeRound2(row.total as number));
    }
    for (const row of expenseAgg) {
      expenseByMonth.set(row._id as number, safeRound2(row.total as number));
    }

    // ── Monthly array (meses 1–12) ────────────
    const monthly: MonthlyEntry[] = [];
    for (let m = 1; m <= 12; m++) {
      const incomePaid          = incomeByMonth.get(m)  ?? 0;
      const expensesBusinessPaid = expenseByMonth.get(m) ?? 0;
      monthly.push({
        month:                m,
        incomePaid,
        expensesBusinessPaid,
        profit:               safeRound2(incomePaid - expensesBusinessPaid),
      });
    }

    // ── Totales anuales ───────────────────────
    const totalIncomePaid = safeRound2(
      monthly.reduce((s, m) => s + m.incomePaid, 0)
    );
    const totalExpenses = safeRound2(
      monthly.reduce((s, m) => s + m.expensesBusinessPaid, 0)
    );
    const totalProfit      = safeRound2(totalIncomePaid - totalExpenses);
    const totalOutstanding = safeRound2(
      outstandingAgg[0]?.total ?? 0
    );

    const response: SummaryResponse = {
      success: true,
      year,
      totals: {
        incomePaid:           totalIncomePaid,
        expensesBusinessPaid: totalExpenses,
        profit:               totalProfit,
        outstanding:          totalOutstanding,
      },
      monthly,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/reports/summary]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}