import mongoose, { Document, Model, Schema } from "mongoose";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface IClient extends Document {
  ownerId: mongoose.Types.ObjectId;
  companyName?: string;
  contactName?: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  email?: string;
  phone?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// Utilidad: nombre para mostrar en factura
// Prioridad: companyName > contactName > "Unbekannt"
// ─────────────────────────────────────────────

export function getClientDisplayName(
  client: Pick<IClient, "companyName" | "contactName">
): string {
  return client.companyName ?? client.contactName ?? "Unbekannt";
}

// ─────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────

const ClientSchema = new Schema<IClient>(
  {
    ownerId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    contactName: {
      type: String,
      trim: true,
    },
    street: {
      type:     String,
      required: true,
      trim:     true,
    },
    zip: {
      type:     String,
      required: true,
      trim:     true,
    },
    city: {
      type:     String,
      required: true,
      trim:     true,
    },
    country: {
      type:     String,
      required: true,
      trim:     true,
      default:  "Deutschland",
    },
    email: {
      type:      String,
      trim:      true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
// Validación: al menos companyName o contactName
// ─────────────────────────────────────────────

ClientSchema.pre("validate", function (next) {
  const hasCompany = typeof this.companyName === "string" && this.companyName.trim().length > 0;
  const hasContact = typeof this.contactName === "string" && this.contactName.trim().length > 0;

  if (!hasCompany && !hasContact) {
    return next(
      new Error(
        "Es muss mindestens companyName oder contactName angegeben werden."
      )
    );
  }
  next();
});

// ─────────────────────────────────────────────
// Índices
// ─────────────────────────────────────────────

ClientSchema.index({ ownerId: 1, isActive: 1 });
ClientSchema.index({ ownerId: 1, companyName: 1 });
ClientSchema.index({ ownerId: 1, contactName: 1 });

// ─────────────────────────────────────────────
// Modelo (singleton para Next.js HMR)
// ─────────────────────────────────────────────

const Client: Model<IClient> =
  mongoose.models.Client ||
  mongoose.model<IClient>("Client", ClientSchema);

export default Client;