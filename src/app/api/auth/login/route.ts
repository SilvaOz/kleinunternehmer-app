import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { UserLoginSchema } from "@/lib/validations";
import User from "@/models/User";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw    = await req.json();
    const parsed = UserLoginSchema.safeParse(raw);

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

    const { email, password } = parsed.data;

    await connectDB();

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: "Ungültige Zugangsdaten" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Ungültige Zugangsdaten" },
        { status: 401 }
      );
    }

    // ── await cookies() para Next.js 15/16 ───
    const cookieStore = await cookies();
    await createSession(cookieStore, user._id.toString(), user.email);

    return NextResponse.json(
      {
        success: true,
        user: {
          id:      user._id.toString(),
          email:   user.email,
          vatMode: user.vatMode,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}