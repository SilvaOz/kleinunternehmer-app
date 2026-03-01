import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import { InvoiceDraftCreateSchema } from "@/lib/validations";
import Invoice from "@/models/Invoice";
import mongoose from "mongoose";

// ─────────────────────────────────────────────
// GET /api/invoices
// Lista facturas del usuario
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
    const status = searchParams.get("status")?.trim();
    const year = searchParams.get("year")?.trim();
    const q = searchParams.get("q")?.trim();

    const filter: Record<string, any> = { ownerId };

    if (status) filter.status = status;

    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) filter.year = yearNum;
    }

    if (q && q.length > 0) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { invoiceNumber: regex },
        { "clientSnapshot.companyName": regex },
        { "clientSnapshot.contactName": regex },
      ];
    }

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      { success: true, data: invoices },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/invoices]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// POST /api/invoices
// Crear draft
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

    const raw = await req.json();
    const parsed = InvoiceDraftCreateSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validierungsfehler",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await connectDB();

    const { clientId, items, dueAt, footerText } = parsed.data;

    const tempId = new mongoose.Types.ObjectId();

    // Normalizar y validar items
    let normalizedItems: any[] = [];

    if (Array.isArray(items)) {
      normalizedItems = items.map((item: any) => ({
        title: item.title || "",
        lines: Array.isArray(item.lines) ? item.lines : [],
        qty: typeof item.qty === "number" ? item.qty : 1,
        unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : 0,
      }));
    }

    const invoiceData: Record<string, any> = {
      ownerId,
      status: "draft",
      locked: false,
      invoiceNumber: `draft-${tempId.toString()}`,
      year: 0,
      sequence: 0,
      currency: "EUR",
      items: normalizedItems,
    };

    if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      invoiceData.clientId = new mongoose.Types.ObjectId(clientId);
    }

    if (dueAt) {
      invoiceData.dueAt = new Date(dueAt);
    }

    if (footerText) {
      invoiceData.footerText = footerText;
    }

    const invoice = await Invoice.create(invoiceData);

    return NextResponse.json(
      { success: true, data: invoice },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/invoices] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}