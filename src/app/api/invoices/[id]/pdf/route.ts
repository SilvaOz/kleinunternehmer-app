export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import { connectDB } from "@/lib/db";
import { getOwnerIdFromCookies } from "@/lib/auth";
import Invoice from "@/models/Invoice";
import User from "@/models/User";
import InvoicePDF from "@/services/pdf/InvoicePDF";
import type { IInvoiceLean } from "@/services/pdf/InvoicePDF";
import type { ICompanySettings } from "@/models/User";

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

type RouteContext = { params: Promise<{ id: string }> };

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

    if (invoice.status === "draft" || !invoice.clientSnapshot) {
      return NextResponse.json(
        {
          success: false,
          error: "PDF ist nur für ausgestellte Rechnungen verfügbar.",
        },
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
      stornoOf:             invoice.stornoOf?.toString(),
      stornoId:             invoice.stornoId?.toString(),
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
      bic:           user.company.bic,
      bankName:      user.company.bankName,
      accountHolder: user.company.accountHolder,
    };

    type PdfFn = (el: object) => { toBuffer(): Promise<Buffer> };
    const buffer = await (pdf as unknown as PdfFn)(
      createElement(InvoicePDF, { invoice: invoiceLean, company })
    ).toBuffer();

    const filename = `Rechnung-${invoice.invoiceNumber}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/invoices/:id/pdf]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}