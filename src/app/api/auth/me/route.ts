import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import User from "@/models/User";
import mongoose from "mongoose";

export async function GET(): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(new mongoose.Types.ObjectId(ownerId))
      .select("-passwordHash")
      .lean();

    if (!user) {
      return NextResponse.json({ success: false, error: "User nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (e) {
    console.error("[GET /api/auth/me]", e);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}
