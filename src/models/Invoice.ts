import mongoose, { Document, Model, Schema } from "mongoose";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type InvoiceStatus = "draft" | "issued" | "paid" | "canceled";

export interface IClientSnapshot {
  companyName?: string;
  contactName?: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface IInvoiceItem {
  title: string;
  lines?: string[];
  qty: number;
  unitPrice: number; // puede ser negativo en storno
}

export interface IPdfMeta {
  url: string;
  sha256: string;
  generatedAt: Date;
}

export interface IInvoice extends Document {
  ownerId: mongoose.Types.ObjectId;

  year: number;          // 0 en draft
  sequence: number;      // 0 en draft
  invoiceNumber: string; // "draft-..." en draft, "YYYY-0001" al emitir

  status: InvoiceStatus;
  issuedAt?: Date;
  dueAt?: Date;
  paidAt?: Date;

  locked: boolean;

  clientId?: mongoose.Types.ObjectId;
  clientSnapshot?: IClientSnapshot;

  items: IInvoiceItem[];
  currency: string;

  subtotal: number;
  total: number;

  kleinunternehmerText: string;
  footerText?: string;

  pdf?: IPdfMeta;
  // TODO: xrechnung?: { url: string; generatedAt: Date }

  // ── Storno ──────────────────────────────────
  stornoOf?: mongoose.Types.ObjectId; // esta factura es storno de...
  stornoId?: mongoose.Types.ObjectId; // referencia al storno creado (en la original)
  // ────────────────────────────────────────────

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────

const ClientSnapshotSchema = new Schema<IClientSnapshot>(
  {
    companyName: { type: String, trim: true },
    contactName: { type: String, trim: true },
    street: { type: String, required: true, trim: true },
    zip: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: "Deutschland" },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const InvoiceItemSchema = new Schema<IInvoiceItem>(
  {
    title: { type: String, required: true, trim: true },
    lines: [{ type: String, trim: true }],
    qty: { type: Number, required: true, default: 1, min: 0 },
    // unitPrice puede ser negativo en stornorechnung
    unitPrice: { type: Number, required: true },
  },
  { _id: false }
);

const PdfMetaSchema = new Schema<IPdfMeta>(
  {
    url: { type: String, required: true },
    sha256: { type: String, required: true },
    generatedAt: { type: Date, required: true },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Schema principal
// ─────────────────────────────────────────────

const InvoiceSchema = new Schema<IInvoice>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // drafts usan 0/0
    year: { type: Number, required: true, default: 0 },
    sequence: { type: Number, required: true, default: 0 },

    invoiceNumber: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ["draft", "issued", "paid", "canceled"],
      default: "draft",
      required: true,
    },

    issuedAt: { type: Date },
    dueAt: { type: Date },
    paidAt: { type: Date },

    locked: { type: Boolean, default: false },

    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
    },
    clientSnapshot: {
      type: ClientSnapshotSchema,
    },

    items: {
      type: [InvoiceItemSchema],
      required: true,
      default: [],
    },

    currency: {
      type: String,
      default: "EUR",
      uppercase: true,
      trim: true,
    },

    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    kleinunternehmerText: {
      type: String,
      required: true,
      default: () =>
        process.env.INVOICE_KLEINUNTERNEHMER_TEXT ??
        "Gemäß §19 UStG wird keine Umsatzsteuer berechnet.",
    },

    footerText: {
      type: String,
      default: () => process.env.INVOICE_FOOTER_TEXT ?? "",
    },

    pdf: {
      type: PdfMetaSchema,
    },

    // ── Storno ────────────────────────────────
    stornoOf: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
    },
    stornoId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
// Índices
// ─────────────────────────────────────────────

// invoiceNumber único por usuario (incluye drafts)
InvoiceSchema.index({ ownerId: 1, invoiceNumber: 1 }, { unique: true });

// year+sequence solo aplica cuando year > 0 (evita choque en drafts 0/0)
InvoiceSchema.index(
  { ownerId: 1, year: 1, sequence: 1 },
  { unique: true, partialFilterExpression: { year: { $gt: 0 } } }
);

InvoiceSchema.index({ ownerId: 1, status: 1 });
InvoiceSchema.index({ ownerId: 1, issuedAt: -1 });
InvoiceSchema.index({ ownerId: 1, paidAt: -1 });

// storno: solo 1 storno por factura y por usuario
// partialFilterExpression excluye documentos donde stornoOf es null/ausente
// (sparse:true en MongoDB incluye null, lo que causaba conflictos en drafts)
InvoiceSchema.index(
  { ownerId: 1, stornoOf: 1 },
  { unique: true, partialFilterExpression: { stornoOf: { $type: "objectId" } } }
);
InvoiceSchema.index({ ownerId: 1, stornoId: 1 }, { sparse: true });

// ─────────────────────────────────────────────
// Pre-validate: bloquear edición de items si locked
// ─────────────────────────────────────────────

InvoiceSchema.pre("validate", function (next) {
  if (this.isModified("items") && this.locked) {
    return next(
      new Error(
        "Rechnungspositionen können nicht geändert werden – " +
        "die Rechnung ist gesperrt (locked=true)."
      )
    );
  }
  next();
});

// ─────────────────────────────────────────────
// Pre-validate: clientSnapshot obligatorio
// al pasar a issued / paid / canceled
// ─────────────────────────────────────────────

InvoiceSchema.pre("validate", function (next) {
  const requiresSnapshot =
    this.status === "issued" ||
    this.status === "paid" ||
    this.status === "canceled";

  if (requiresSnapshot && !this.clientSnapshot) {
    return next(
      new Error(
        "clientSnapshot ist erforderlich, wenn die Rechnung " +
        "ausgestellt, bezahlt oder storniert wird."
      )
    );
  }
  next();
});

// ─────────────────────────────────────────────
// Pre-save: calcular subtotal y total desde items
// Funciona también para storno (valores negativos)
// ─────────────────────────────────────────────

InvoiceSchema.pre("save", function (next) {
  if (this.isModified("items") || this.isNew) {
    const subtotal = this.items.reduce(
      (sum, item) => sum + item.qty * item.unitPrice,
      0
    );
    this.subtotal = Math.round(subtotal * 100) / 100;
    this.total = this.subtotal;
  }
  next();
});

// ─────────────────────────────────────────────
// Modelo (singleton para Next.js HMR)
// ─────────────────────────────────────────────

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice ||
  mongoose.model<IInvoice>("Invoice", InvoiceSchema);

export default Invoice;