import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import { InvoiceDraftUpdateSchema, ClientSnapshotSchema } from "@/lib/validations";
import Invoice from "@/models/Invoice";

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

type RouteContext = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────
// GET /api/invoices/:id
// ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: "Nicht autorisiert" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "Ungültige ID" },
        { status: 400 }
      );
    }

    await connectDB();

    const invoice = await Invoice.findOne({
      _id: id,
      ownerId,
    }).lean();

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: invoice }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/invoices/:id]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PUT /api/invoices/:id
// Solo editable si status=draft y locked=false
// ─────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: "Nicht autorisiert" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "Ungültige ID" },
        { status: 400 }
      );
    }

    const raw = await req.json();
    const parsed = InvoiceDraftUpdateSchema.safeParse(raw);

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

    const invoice = await Invoice.findOne({ _id: id, ownerId });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden" },
        { status: 404 }
      );
    }

    if (invoice.status !== "draft" || invoice.locked) {
      return NextResponse.json(
        { success: false, error: "Rechnung ist gesperrt" },
        { status: 409 }
      );
    }

    const { clientId, items, dueAt, footerText } = parsed.data;

    if (clientId !== undefined) invoice.clientId = new mongoose.Types.ObjectId(clientId);
    if (items !== undefined) invoice.items = items;
    if (dueAt !== undefined) invoice.dueAt = dueAt;
    if (footerText !== undefined) invoice.footerText = footerText;

    await invoice.save();

    return NextResponse.json({ success: true, data: invoice }, { status: 200 });
  } catch (error) {
    console.error("[PUT /api/invoices/:id]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/invoices/:id
// Solo si status=draft → status=canceled, locked=true
// ─────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: "Nicht autorisiert" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "Ungültige ID" },
        { status: 400 }
      );
    }

    await connectDB();

    const invoice = await Invoice.findOne({ _id: id, ownerId }).lean();

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden" },
        { status: 404 }
      );
    }

    if (invoice.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Rechnung ist gesperrt" },
        { status: 409 }
      );
    }

    await Invoice.updateOne(
      { _id: id, ownerId },
      { $set: { status: "canceled", locked: true } }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/invoices/:id]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PATCH /api/invoices/:id
// Edita clientSnapshot y/o invoiceNumber (cualquier status)
// ─────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: "Nicht autorisiert" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: "Ungültige ID" },
        { status: 400 }
      );
    }

    const raw = await req.json();
    const update: Record<string, unknown> = {};

    if (raw.clientSnapshot !== undefined) {
      const parsed = ClientSnapshotSchema.safeParse(raw.clientSnapshot);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validierungsfehler", details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      update.clientSnapshot = parsed.data;
    }

    if (raw.invoiceNumber !== undefined) {
      const num = String(raw.invoiceNumber).trim();
      if (!num) {
        return NextResponse.json(
          { success: false, error: "Rechnungsnummer darf nicht leer sein" },
          { status: 400 }
        );
      }
      update.invoiceNumber = num;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, error: "Keine Änderungen übergeben" },
        { status: 400 }
      );
    }

    await connectDB();

    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, ownerId },
      { $set: update },
      { new: true }
    ).lean();

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: invoice }, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/invoices/:id]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}