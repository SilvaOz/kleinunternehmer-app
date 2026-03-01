import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import { ExpenseCreateSchema } from "@/lib/validations";
import Expense from "@/models/Expense";

// ─────────────────────────────────────────────
// GET /api/expenses
// Lista gastos del usuario con filtros opcionales
// Query: ?year=2026 ?category=software ?paid=true ?q=searchTerm
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
    const year     = searchParams.get("year")?.trim();
    const category = searchParams.get("category")?.trim();
    const paid     = searchParams.get("paid")?.trim();
    const q        = searchParams.get("q")?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { ownerId };

    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        filter.date = {
          $gte: new Date(Date.UTC(yearNum, 0, 1)),
          $lte: new Date(Date.UTC(yearNum, 11, 31, 23, 59, 59, 999)),
        };
      }
    }

    if (category) {
      filter.category = category;
    }

    if (paid !== null && paid !== undefined && paid !== "") {
      filter.paid = paid === "true";
    }

    if (q && q.length > 0) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { description: regex },
        { vendor:      regex },
      ];
    }

    const expenses = await Expense.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .lean({ virtuals: true });

    return NextResponse.json(
      { success: true, data: expenses },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/expenses]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// POST /api/expenses
// Crear nuevo gasto para el usuario autenticado
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

    const raw    = await req.json();
    const parsed = ExpenseCreateSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:   "Validierungsfehler",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await connectDB();

    const expense = await Expense.create({
      ...parsed.data,
      ownerId,
    });

    // lean+virtuals para incluir amountBusiness en respuesta
    const result = await Expense.findById(expense._id)
      .lean({ virtuals: true });

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/expenses]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}