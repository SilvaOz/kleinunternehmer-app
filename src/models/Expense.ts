import mongoose, { Document, Model, Schema } from "mongoose";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type ExpenseCategory =
  | "software"
  | "hardware"
  | "office"
  | "training"
  | "travel"
  | "hosting"
  | "services"
  | "other";

export interface IReceiptMeta {
  url?: string;
  sha256?: string;
}

export interface IExpense extends Document {
  ownerId: mongoose.Types.ObjectId;
  date: Date;
  vendor?: string;
  description: string;
  category: ExpenseCategory;
  amountGross: number;
  businessUsePct: number;
  paid: boolean;
  paidAt?: Date;
  receipt?: IReceiptMeta;
  notes?: string;
  // virtual
  amountBusiness: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────

const ExpenseSchema = new Schema<IExpense>(
  {
    ownerId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    date: {
      type:     Date,
      required: true,
    },
    vendor: {
      type: String,
      trim: true,
    },
    description: {
      type:     String,
      required: true,
      trim:     true,
    },
    category: {
      type:     String,
      required: true,
      enum:     [
        "software",
        "hardware",
        "office",
        "training",
        "travel",
        "hosting",
        "services",
        "other",
      ] satisfies ExpenseCategory[],
    },
    amountGross: {
      type:     Number,
      required: true,
      min:      0,
    },
    businessUsePct: {
      type:     Number,
      required: true,
      default:  100,
      min:      0,
      max:      100,
    },
    paid: {
      type:    Boolean,
      default: true,
    },
    paidAt: {
      type: Date,
    },
    receipt: {
      type: new Schema<IReceiptMeta>(
        {
          url:    { type: String, trim: true },
          sha256: { type: String, trim: true },
        },
        { _id: false }
      ),
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─────────────────────────────────────────────
// Virtual: amountBusiness (no persistente)
// amountGross * (businessUsePct / 100), 2 decimales
// ─────────────────────────────────────────────

ExpenseSchema.virtual("amountBusiness").get(function (this: IExpense): number {
  return Math.round(this.amountGross * (this.businessUsePct / 100) * 100) / 100;
});

// ─────────────────────────────────────────────
// Pre-save: paidAt automático
// Si paid=true y paidAt no está definido → usar date
// Si paid=false → limpiar paidAt
// ─────────────────────────────────────────────

ExpenseSchema.pre("save", function (next) {
  if (this.paid && !this.paidAt) {
    this.paidAt = this.date;
  }
  if (!this.paid) {
    this.paidAt = undefined;
  }
  next();
});

// ─────────────────────────────────────────────
// Índices
// ─────────────────────────────────────────────

ExpenseSchema.index({ ownerId: 1, date: -1 });
ExpenseSchema.index({ ownerId: 1, category: 1 });
ExpenseSchema.index({ ownerId: 1, paid: 1 });

// ─────────────────────────────────────────────
// Modelo (singleton para Next.js HMR)
// ─────────────────────────────────────────────

const Expense: Model<IExpense> =
  mongoose.models.Expense ||
  mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;