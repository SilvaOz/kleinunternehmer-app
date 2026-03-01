export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Invoice from "@/models/Invoice";
import User from "@/models/User";
import type { ICompanySettings } from "@/models/User";
import type { IInvoiceLean } from "@/services/pdf/InvoicePDF";
import { generateXRechnung } from "@/services/erechnung/generateXRechnung";

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/invoices/[id]/xrechnung
 *
 * Returns an XRechnung 3.0 (EN 16931) compliant XML file for the invoice.
 * Only available for invoices with status "issued" or "paid".
 * Draft and canceled invoices return 409.
 */
export async function GET(
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

    const invoice = await Invoice.findOne({ _id: id, ownerId }).lean();

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Rechnung nicht gefunden" },
        { status: 404 }
      );
    }

    if (invoice.status === "draft" || invoice.status === "canceled") {
      return NextResponse.json(
        {
          success: false,
          error:
            "XRechnung ist nur für ausgestellte oder bezahlte Rechnungen verfügbar.",
        },
        { status: 409 }
      );
    }

    if (!invoice.clientSnapshot) {
      return NextResponse.json(
        { success: false, error: "Kein Empfänger-Snapshot vorhanden." },
        { status: 409 }
      );
    }

    const user = await User.findById(ownerId).select("-passwordHash").lean();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }

    const invoiceLean: IInvoiceLean = {
      _id:                  invoice._id.toString(),
      invoiceNumber:        invoice.invoiceNumber,
      status:               invoice.status,
      issuedAt:             invoice.issuedAt ? new Date(invoice.issuedAt) : undefined,
      dueAt:                invoice.dueAt    ? new Date(invoice.dueAt)    : undefined,
      paidAt:               invoice.paidAt   ? new Date(invoice.paidAt)   : undefined,
      locked:               invoice.locked,
      items:                invoice.items.map((item) => ({
        title:     item.title,
        lines:     item.lines ?? [],
        qty:       item.qty,
        unitPrice: item.unitPrice,
      })),
      clientSnapshot:       invoice.clientSnapshot,
      currency:             invoice.currency,
      subtotal:             invoice.subtotal,
      total:                invoice.total,
      kleinunternehmerText: invoice.kleinunternehmerText,
      footerText:           invoice.footerText,
    };

    const company: ICompanySettings = {
      name:      user.company.name,
      street:    user.company.street,
      zip:       user.company.zip,
      city:      user.company.city,
      country:   user.company.country,
      email:     user.company.email,
      phone:     user.company.phone,
      taxNumber: user.company.taxNumber,
      iban:      user.company.iban,
      bic:       user.company.bic,
      bankName:  user.company.bankName,
    };

    const xml = generateXRechnung(invoiceLean, company);
    const filename = `XRechnung-${invoice.invoiceNumber}.xml`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type":        "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/invoices/:id/xrechnung]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
