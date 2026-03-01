import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies, verifyPassword, hashPassword } from "@/lib/auth";
import User from "@/models/User";
import mongoose from "mongoose";

// ── PATCH /api/auth/password ──────────────────
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Aktuelles und neues Passwort erforderlich." },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 10) {
      return NextResponse.json(
        { success: false, error: "Neues Passwort muss mindestens 10 Zeichen haben." },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findById(new mongoose.Types.ObjectId(ownerId));
    if (!user) {
      return NextResponse.json({ success: false, error: "User nicht gefunden" }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Aktuelles Passwort ist falsch." },
        { status: 400 }
      );
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[PATCH /api/auth/password]", e);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}
