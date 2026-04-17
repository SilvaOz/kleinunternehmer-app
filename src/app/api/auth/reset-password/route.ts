import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Ungültiger Token." }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiresAt: { $gt: new Date() },
    }).select("+resetToken +resetTokenExpiresAt");

    if (!user) {
      return NextResponse.json({ error: "Token ungültig oder abgelaufen." }, { status: 400 });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetToken = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
