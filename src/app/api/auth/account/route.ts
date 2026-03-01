import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies, destroySession } from "@/lib/auth";
import User from "@/models/User";
import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import Client from "@/models/Client";
import Counter from "@/models/Counter";
import mongoose from "mongoose";

// ── PUT /api/auth/account — actualizar datos de empresa ──
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const { email, company } = body;

    const update: Record<string, unknown> = {};
    if (email && typeof email === "string") {
      update.email = email.trim().toLowerCase();
    }

    if (company && typeof company === "object") {
      const allowed = [
        "name", "street", "zip", "city", "country",
        "email", "phone", "taxNumber",
        "iban", "bic", "bankName", "accountHolder",
      ] as const;
      for (const k of allowed) {
        if (company[k] !== undefined) {
          update[`company.${k}`] = company[k];
        }
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: "Keine Felder zum Aktualisieren." }, { status: 400 });
    }

    const user = await User.findByIdAndUpdate(
      new mongoose.Types.ObjectId(ownerId),
      { $set: update },
      { new: true, select: "-passwordHash" }
    ).lean();

    return NextResponse.json({ success: true, data: user });
  } catch (e) {
    console.error("[PUT /api/auth/account]", e);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}

// ── DELETE /api/auth/account — borrar cuenta completa ────
export async function DELETE(): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });
    }

    await connectDB();

    const id = new mongoose.Types.ObjectId(ownerId);

    await Invoice.deleteMany({ ownerId: id });
    await Expense.deleteMany({ ownerId: id });
    await Client.deleteMany({ ownerId: id });
    await Counter.deleteMany({ ownerId: id });
    await User.findByIdAndDelete(id);

    const cookieStore = await cookies();
    destroySession(cookieStore);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/auth/account]", e);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}
