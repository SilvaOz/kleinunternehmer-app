export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import type { Readable } from "stream";
import { createElement } from "react";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Client from "@/models/Client";
import Invoice from "@/models/Invoice";
import Counter, { formatInvoiceNumber } from "@/models/Counter";
import InvoicePDF from "@/services/pdf/InvoicePDF";
import type { IInvoiceLean } from "@/services/pdf/InvoicePDF";
import type { ICompanySettings } from "@/models/User";
import type { IClientSnapshot } from "@/models/Invoice";

// ─── Package price map ────────────────────────────────────────────────────────

const PACKAGE_PRICES: Record<string, number> = {
  "express-24h": 1499,
  "wp-base":     700,
  "wp-premium":  900,
  "wp-pro":      1500,
  "web-app":     3500,
};

const DEFAULT_DUE_DAYS = parseInt(
  process.env.INVOICE_DEFAULT_DUE_DAYS ?? "14",
  10
);

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

// ─── Request body type ────────────────────────────────────────────────────────

interface AngebotBody {
  name: string;
  email: string;
  packageId: string;
  packageName: string;
  description: string;
  timing?: string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Validate API key
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Nicht autorisiert" },
      { status: 401 }
    );
  }

  let body: AngebotBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Ungültiger Body" },
      { status: 400 }
    );
  }

  const { name, email, packageId, packageName, description, timing } = body;

  if (!name || !email || !packageId || !packageName) {
    return NextResponse.json(
      { success: false, error: "Pflichtfelder fehlen" },
      { status: 400 }
    );
  }

  const unitPrice = PACKAGE_PRICES[packageId];
  if (unitPrice === undefined) {
    return NextResponse.json(
      { success: false, error: `Unbekanntes Paket: ${packageId}` },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    // 2. Resolve owner by INTERNAL_OWNER_EMAIL
    const ownerEmail = process.env.INTERNAL_OWNER_EMAIL;
    if (!ownerEmail) {
      throw new Error("INTERNAL_OWNER_EMAIL not configured");
    }

    const owner = await User.findOne({ email: ownerEmail }).lean();
    if (!owner) {
      return NextResponse.json(
        { success: false, error: "Owner nicht gefunden" },
        { status: 500 }
      );
    }

    const ownerId = owner._id.toString();

    // 3. Upsert client by email
    let client = await Client.findOne({ ownerId: owner._id, email: email.toLowerCase() });

    if (!client) {
      client = await Client.create({
        ownerId:     owner._id,
        contactName: name,
        email:       email.toLowerCase(),
        street:      "–",
        zip:         "–",
        city:        "–",
        country:     "Deutschland",
      });
    }

    // 4. Build invoice items
    const lines: string[] = [description];
    if (timing) lines.push(`Start: ${timing}`);

    // 5. Create draft invoice
    const draftNumber = `draft-${Date.now()}`;
    const invoice = await Invoice.create({
      ownerId: owner._id,
      clientId: client._id,
      invoiceNumber: draftNumber,
      status: "draft",
      items: [
        {
          title:     packageName,
          lines,
          qty:       1,
          unitPrice,
        },
      ],
    });

    // 6. Issue invoice (inline logic, avoids HTTP round-trip)
    const clientSnapshot: IClientSnapshot = {
      contactName: client.contactName,
      companyName: client.companyName,
      street:      client.street,
      zip:         client.zip,
      city:        client.city,
      country:     client.country,
      email:       client.email,
      phone:       client.phone,
    };

    const year          = new Date().getFullYear();
    const sequence      = await Counter.nextSequence(ownerId, year);
    const invoiceNumber = formatInvoiceNumber(year, sequence);
    const issuedAt      = new Date();
    const dueAt         = addDays(issuedAt, DEFAULT_DUE_DAYS);

    invoice.year           = year;
    invoice.sequence       = sequence;
    invoice.invoiceNumber  = invoiceNumber;
    invoice.clientSnapshot = clientSnapshot;
    invoice.status         = "issued";
    invoice.issuedAt       = issuedAt;
    invoice.dueAt          = dueAt;
    invoice.locked         = true;

    await invoice.save();

    // 7. Build PDF
    const invoiceLean: IInvoiceLean = {
      _id:                  invoice._id.toString(),
      invoiceNumber:        invoice.invoiceNumber,
      status:               invoice.status,
      issuedAt:             invoice.issuedAt,
      dueAt:                invoice.dueAt,
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
      name:          owner.company.name,
      street:        owner.company.street,
      zip:           owner.company.zip,
      city:          owner.company.city,
      country:       owner.company.country,
      email:         owner.company.email,
      phone:         owner.company.phone,
      taxNumber:     owner.company.taxNumber,
      iban:          owner.company.iban,
      bic:           owner.company.bic,
      bankName:      owner.company.bankName,
      accountHolder: owner.company.accountHolder,
    };

    const stream = await renderToStream(
      createElement(InvoicePDF, { invoice: invoiceLean, company }) as any
    ) as Readable;

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end",  () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });

    const pdfBase64 = buffer.toString("base64");
    const filename  = `Rechnung-${invoiceNumber}.pdf`;

    return NextResponse.json({
      success:       true,
      invoiceId:     invoice._id.toString(),
      invoiceNumber,
      total:         invoice.total,
      dueAt:         dueAt.toISOString(),
      pdfBase64,
      filename,
    });
  } catch (error) {
    console.error("[POST /api/internal/angebot]", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
