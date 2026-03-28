import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Expense from "@/models/Expense";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

type RouteContext = { params: Promise<{ id: string }> };

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ─────────────────────────────────────────────
// POST /api/expenses/:id/receipt
// Sube o reemplaza el recibo (multipart/form-data, campo "receipt")
// ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });

    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Ungültige ID" }, { status: 400 });

    await connectDB();

    const expense = await Expense.findOne({ _id: id, ownerId });
    if (!expense) return NextResponse.json({ success: false, error: "Ausgabe nicht gefunden" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("receipt") as File | null;

    if (!file) return NextResponse.json({ success: false, error: "Keine Datei übertragen" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: "Nur PDF, JPG oder PNG erlaubt" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: "Datei zu groß (max. 10 MB)" }, { status: 400 });
    }

    const db = mongoose.connection.db!;
    const bucket = new GridFSBucket(db, { bucketName: "receipts" });

    // Borrar recibo anterior si existe
    if (expense.receiptFileId) {
      try { await bucket.delete(expense.receiptFileId as unknown as mongoose.mongo.BSON.ObjectId); } catch (_) { /* ya no existe */ }
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadStream = bucket.openUploadStream(file.name, {
      contentType: file.type,
      metadata: { ownerId, expenseId: id },
    });

    await new Promise<void>((resolve, reject) => {
      uploadStream.end(buffer);
      uploadStream.once("finish", resolve);
      uploadStream.once("error", reject);
    });

    expense.receiptFileId = uploadStream.id as unknown as mongoose.Types.ObjectId;
    expense.receiptFilename = file.name;
    await expense.save();

    const result = await Expense.findById(expense._id).lean({ virtuals: true });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/expenses/:id/receipt]", error);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// GET /api/expenses/:id/receipt
// Descarga el recibo desde GridFS
// ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) return new Response("Nicht autorisiert", { status: 401 });

    const { id } = await params;
    if (!isValidObjectId(id)) return new Response("Ungültige ID", { status: 400 });

    await connectDB();

    const expense = await Expense.findOne({ _id: id, ownerId }).lean();
    if (!expense) return new Response("Ausgabe nicht gefunden", { status: 404 });
    if (!expense.receiptFileId) return new Response("Kein Beleg vorhanden", { status: 404 });

    const db = mongoose.connection.db!;
    const bucket = new GridFSBucket(db, { bucketName: "receipts" });

    // Obtener metadata del archivo
    const files = await bucket
      .find({ _id: expense.receiptFileId as unknown as mongoose.mongo.BSON.ObjectId })
      .toArray();

    if (!files.length) return new Response("Datei nicht gefunden", { status: 404 });

    const fileMeta = files[0];
    const contentType = fileMeta.contentType ?? "application/octet-stream";
    const filename = expense.receiptFilename ?? fileMeta.filename ?? "beleg";

    const downloadStream = bucket.openDownloadStream(
      expense.receiptFileId as unknown as mongoose.mongo.BSON.ObjectId
    );

    const readableStream = new ReadableStream({
      start(controller) {
        downloadStream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
        downloadStream.on("end", () => controller.close());
        downloadStream.on("error", (err: Error) => controller.error(err));
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/expenses/:id/receipt]", error);
    return new Response("Interner Serverfehler", { status: 500 });
  }
}

// ─────────────────────────────────────────────
// DELETE /api/expenses/:id/receipt
// Elimina el recibo de GridFS y limpia los campos
// ─────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const ownerId = await getOwnerIdFromCookies();
    if (!ownerId) return NextResponse.json({ success: false, error: "Nicht autorisiert" }, { status: 401 });

    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Ungültige ID" }, { status: 400 });

    await connectDB();

    const expense = await Expense.findOne({ _id: id, ownerId });
    if (!expense) return NextResponse.json({ success: false, error: "Ausgabe nicht gefunden" }, { status: 404 });
    if (!expense.receiptFileId) return NextResponse.json({ success: false, error: "Kein Beleg vorhanden" }, { status: 404 });

    const db = mongoose.connection.db!;
    const bucket = new GridFSBucket(db, { bucketName: "receipts" });

    try {
      await bucket.delete(expense.receiptFileId as unknown as mongoose.mongo.BSON.ObjectId);
    } catch (_) { /* ya no existe en GridFS */ }

    await Expense.updateOne(
      { _id: id, ownerId },
      { $unset: { receiptFileId: "", receiptFilename: "" } }
    );

    const result = await Expense.findById(id).lean({ virtuals: true });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/expenses/:id/receipt]", error);
    return NextResponse.json({ success: false, error: "Interner Serverfehler" }, { status: 500 });
  }
}
