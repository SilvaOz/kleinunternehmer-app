import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Invoice from "@/models/Invoice";

const PaySchema = z.object({
    paidAt: z.coerce.date().optional(),
});

function isValidObjectId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
    req: NextRequest,
    { params }: RouteContext
): Promise<NextResponse> {
    try {
        const { id } = await params;

        const ownerId = await getOwnerIdFromCookies();
        if (!ownerId) {
            return NextResponse.json(
                { success: false, error: "Nicht autorisiert" },
                { status: 401 }
            );
        }

        if (!isValidObjectId(id)) {
            return NextResponse.json(
                { success: false, error: "Ungültige ID" },
                { status: 400 }
            );
        }

        const raw = await req.json().catch(() => ({}));
        const parsed = PaySchema.safeParse(raw);

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

        if (invoice.status === "draft" || invoice.status === "canceled") {
            return NextResponse.json(
                { success: false, error: "Rechnung ist nicht ausgestellt" },
                { status: 409 }
            );
        }

        if (invoice.status === "paid") {
            return NextResponse.json(
                { success: true, data: invoice },
                { status: 200 }
            );
        }

        const now = new Date();
        invoice.status = "paid";
        invoice.paidAt = parsed.data.paidAt ?? now;
        invoice.issuedAt = invoice.issuedAt ?? now;

        await invoice.save();

        return NextResponse.json({ success: true, data: invoice }, { status: 200 });
    } catch (error) {
        console.error("[POST /api/invoices/:id/pay]", error);
        return NextResponse.json(
            { success: false, error: "Interner Serverfehler" },
            { status: 500 }
        );
    }
}