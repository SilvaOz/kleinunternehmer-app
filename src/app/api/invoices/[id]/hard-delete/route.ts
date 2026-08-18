import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Invoice from "@/models/Invoice";

type RouteContext = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/invoices/:id/hard-delete
// Eliminación permanente de la BD (cualquier status).
// Limpia referencias storno:
//   – Si esta factura ES un storno (stornoOf): restaura la original a "issued"
//   – Si esta factura TIENE un storno (stornoId): elimina también el storno
// ─────────────────────────────────────────────────────────────────────────────

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

    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    // If this invoice IS a storno → restore the original invoice to "issued"
    if (invoice.stornoOf) {
      await Invoice.updateOne(
        { _id: invoice.stornoOf, ownerId },
        { $set: { status: "issued" }, $unset: { stornoId: "" } }
      );
    }

    // If this invoice HAS a linked storno → also permanently delete the storno
    if (invoice.stornoId) {
      await Invoice.deleteOne({ _id: invoice.stornoId, ownerId });
    }

    // Permanently delete this invoice
    await Invoice.deleteOne({ _id: id, ownerId });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/invoices/:id/hard-delete]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
