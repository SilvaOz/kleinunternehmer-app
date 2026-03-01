import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import { InvoiceIssueSchema } from "@/lib/validations";
import Invoice from "@/models/Invoice";
import Client from "@/models/Client";
import Counter, { formatInvoiceNumber } from "@/models/Counter";
import type { IClientSnapshot } from "@/models/Invoice";

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

const DEFAULT_DUE_DAYS = parseInt(
  process.env.INVOICE_DEFAULT_DUE_DAYS ?? "14", 10
);

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

    const raw    = await req.json().catch(() => ({}));
    const parsed = InvoiceIssueSchema.safeParse(raw);

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

    let clientSnapshot: IClientSnapshot;

    if (invoice.clientId) {
      const client = await Client.findOne({
        _id: invoice.clientId,
        ownerId,
      }).lean();

      if (!client) {
        return NextResponse.json(
          { success: false, error: "Kunde nicht gefunden." },
          { status: 400 }
        );
      }

      clientSnapshot = {
        companyName: client.companyName,
        contactName: client.contactName,
        street:      client.street,
        zip:         client.zip,
        city:        client.city,
        country:     client.country,
        email:       client.email,
        phone:       client.phone,
      };
    } else {
      if (!parsed.data.clientSnapshot) {
        return NextResponse.json(
          { success: false, error: "clientSnapshot ist erforderlich." },
          { status: 400 }
        );
      }
      clientSnapshot = parsed.data.clientSnapshot;
    }

    const year          = new Date().getFullYear();
    const sequence      = await Counter.nextSequence(ownerId, year);
    const invoiceNumber = formatInvoiceNumber(year, sequence);
    const issuedAt      = new Date();
    const dueAt         = parsed.data.dueAt ?? addDays(issuedAt, DEFAULT_DUE_DAYS);

    invoice.year           = year;
    invoice.sequence       = sequence;
    invoice.invoiceNumber  = invoiceNumber;
    invoice.clientSnapshot = clientSnapshot;
    invoice.status         = "issued";
    invoice.issuedAt       = issuedAt;
    invoice.dueAt          = dueAt;
    invoice.locked         = true;

    await invoice.save();

    return NextResponse.json(
      { success: true, data: invoice },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/invoices/:id/issue]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}