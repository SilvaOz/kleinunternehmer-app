import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Counter from "@/models/Counter";

// ── GET /api/counter?year=YYYY ──────────────────────────────────────────────
// Returns current sequence for the given year (defaults to current year).
// sequence = last used number, so next invoice = sequence + 1.

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });
    }

    const yearParam = req.nextUrl.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: "Ungültiges Jahr" }, { status: 400 });
    }

    await connectDB();

    const counter = await Counter.findOne({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      year,
    }).lean();

    return NextResponse.json({
      success:  true,
      year,
      sequence: counter?.sequence ?? 0,
    });
  } catch (e) {
    console.error("[GET /api/counter]", e);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}

// ── PATCH /api/counter ──────────────────────────────────────────────────────
// Body: { year: number, sequence: number }
// Sets the counter to the given sequence value.
// The NEXT invoice issued will get sequence + 1.

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, error: "Ungültiger Body" }, { status: 400 });
    }

    const { year, sequence } = body as { year: unknown; sequence: unknown };

    if (
      typeof year     !== "number" || isNaN(year)     || year     < 2000 || year     > 2100 ||
      typeof sequence !== "number" || isNaN(sequence) || sequence <    0 || !Number.isInteger(sequence)
    ) {
      return NextResponse.json(
        { success: false, error: "year (2000–2100) und sequence (≥ 0, ganzzahlig) sind erforderlich" },
        { status: 400 }
      );
    }

    await connectDB();

    const counter = await Counter.findOneAndUpdate(
      { ownerId: new mongoose.Types.ObjectId(ownerId), year },
      { $set: { sequence } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ success: true, year, sequence: counter.sequence });
  } catch (e) {
    console.error("[PATCH /api/counter]", e);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}
