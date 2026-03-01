import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies, hashPassword, verifyPassword } from "@/lib/auth";
import User from "@/models/User";
import mongoose from "mongoose";

// ── GET /api/settings ─────────────────────────
export async function GET(): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });

    await connectDB();
    const user = await User.findById(new mongoose.Types.ObjectId(ownerId))
      .select("-passwordHash")
      .lean();

    if (!user) return NextResponse.json({ success: false, error: "User nicht gefunden" }, { status: 404 });

    return NextResponse.json({ success: true, data: user });
  } catch (e) {
    console.error("[GET /api/settings]", e);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}

// ── PATCH /api/settings ───────────────────────
// Body variant A: company + email update
// Body variant B: { currentPassword, newPassword }
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });

    await connectDB();
    const body = await req.json();

    // Password change
    if (body.currentPassword !== undefined || body.newPassword !== undefined) {
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ success: false, error: "Aktuelles und neues Passwort erforderlich." }, { status: 400 });
      }
      if (typeof newPassword === "string" && newPassword.length < 8) {
        return NextResponse.json({ success: false, error: "Neues Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
      }
      const user = await User.findById(new mongoose.Types.ObjectId(ownerId));
      if (!user) return NextResponse.json({ success: false, error: "User nicht gefunden" }, { status: 404 });
      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) return NextResponse.json({ success: false, error: "Aktuelles Passwort falsch." }, { status: 400 });
      user.passwordHash = await hashPassword(newPassword);
      await user.save();
      return NextResponse.json({ success: true });
    }

    // Company + email update
    const { email, company } = body;
    const update: Record<string, unknown> = {};
    if (email && typeof email === "string") update.email = email.trim().toLowerCase();
    if (company && typeof company === "object") {
      const allowed = ["name","street","zip","city","country","email","phone","taxNumber","iban","bic","bankName","logoUrl"] as const;
      for (const k of allowed) {
        if (company[k] !== undefined) update[`company.${k}`] = company[k];
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
    console.error("[PATCH /api/settings]", e);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}
