import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Invoice from "@/models/Invoice";
import Counter, { formatInvoiceNumber } from "@/models/Counter";

function isValidObjectId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
    _req: NextRequest,
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

        await connectDB();

        const original = await Invoice.findOne({ _id: id, ownerId });

        if (!original) {
            return NextResponse.json(
                { success: false, error: "Rechnung nicht gefunden" },
                { status: 404 }
            );
        }

        if (original.status !== "issued" && original.status !== "paid") {
            return NextResponse.json(
                { success: false, error: "Nur ausgestellte oder bezahlte Rechnungen können storniert werden." },
                { status: 409 }
            );
        }

        const existingStorno = await Invoice.findOne({
            ownerId,
            stornoOf: original._id,
        });

        if (existingStorno) {
            return NextResponse.json(
                { success: false, error: `Für diese Rechnung existiert bereits eine Stornorechnung (${existingStorno.invoiceNumber}).` },
                { status: 409 }
            );
        }

        const year          = new Date().getFullYear();
        const sequence      = await Counter.nextSequence(ownerId, year);
        const invoiceNumber = formatInvoiceNumber(year, sequence);

        const negativeItems = original.items.map((item) => ({
            title:     item.title,
            lines:     item.lines ?? [],
            qty:       item.qty ?? 1,
            unitPrice: -Math.abs(item.unitPrice),
        }));

        // Calculate subtotal manually (insertOne bypasses pre-save hooks)
        const subtotalRounded = Math.round(
            negativeItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0) * 100
        ) / 100;

        try {
            // Use insertOne to bypass validation hooks that reject negative unitPrices
            type LooseColl = { insertOne(doc: Record<string, unknown>): Promise<unknown> };
            await (Invoice.collection as unknown as LooseColl).insertOne({
                ownerId:              new mongoose.Types.ObjectId(ownerId),
                year,
                sequence,
                invoiceNumber,
                status:               "issued",
                issuedAt:             new Date(),
                locked:               true,
                clientId:             original.clientId,
                clientSnapshot:       original.clientSnapshot,
                items:                negativeItems,
                currency:             original.currency || "EUR",
                subtotal:             subtotalRounded,
                total:                subtotalRounded,
                kleinunternehmerText: original.kleinunternehmerText,
                footerText:           `Stornorechnung zu ${original.invoiceNumber}`,
                stornoOf:             original._id,
                createdAt:            new Date(),
                updatedAt:            new Date(),
            });
        } catch (insertError: unknown) {
            // Unique index violation → storno ya existe (race condition)
            if (
                typeof insertError === "object" &&
                insertError !== null &&
                "code" in insertError &&
                (insertError as { code: number }).code === 11000
            ) {
                return NextResponse.json(
                    { success: false, error: "Für diese Rechnung existiert bereits eine Stornorechnung." },
                    { status: 409 }
                );
            }
            throw insertError;
        }

        const storno = await Invoice.findOne({ ownerId, stornoOf: original._id });

        if (!storno) {
            throw new Error("Stornorechnung wurde erstellt, konnte aber nicht abgerufen werden");
        }

        // Use updateOne to avoid pre-save hook validation
        await Invoice.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            {
                $set: {
                    status:   "canceled",
                    locked:   true,
                    stornoId: storno._id,
                },
            },
            { timestamps: true }
        );

        // Fetch updated original invoice
        const updatedOriginal = await Invoice.findById(id);

        return NextResponse.json(
            {
                success: true,
                data: {
                    storno,
                    canceledInvoice: {
                        _id: updatedOriginal?._id.toString(),
                        invoiceNumber: updatedOriginal?.invoiceNumber,
                        status: updatedOriginal?.status,
                    },
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[POST /api/invoices/:id/storno]", error);
        return NextResponse.json(
            { success: false, error: "Interner Serverfehler" },
            { status: 500 }
        );
    }
}