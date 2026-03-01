import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { UserRegisterSchema } from "@/lib/validations";
import User from "@/models/User";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw = await req.json();
    const parsed = UserRegisterSchema.safeParse(raw);

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

    const { email, password, vatMode, vatRate, company } = parsed.data;

    await connectDB();

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return NextResponse.json(
        { success: false, error: "E-Mail existiert bereits" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      email,
      passwordHash,
      vatMode,
      vatRate,
      company,
      isActive: true,
    });

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
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/auth/register]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}