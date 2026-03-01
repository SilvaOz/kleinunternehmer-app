import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import { ClientCreateSchema } from "@/lib/validations";
import Client from "@/models/Client";

// ─────────────────────────────────────────────
// GET /api/clients
// Lista clientes del usuario autenticado
// Query: ?q=searchTerm (opcional)
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
    const q = searchParams.get("q")?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { ownerId };

    if (q && q.length > 0) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { companyName: regex },
        { contactName: regex },
      ];
    }

    const clients = await Client.find(filter)
      .sort({ companyName: 1, contactName: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: clients }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/clients]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// POST /api/clients
// Crear nuevo cliente para el usuario autenticado
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
    const parsed = ClientCreateSchema.safeParse(raw);

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

    const client = await Client.create({
      ...parsed.data,
      ownerId,
    });

    return NextResponse.json(
      { success: true, data: client },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/clients]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}