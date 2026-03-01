import mongoose, { Document, Model, Schema } from "mongoose";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type VatMode = "kleinunternehmer" | "vatRegistered";

export interface ICompanySettings {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  email?: string;
  phone?: string;
  taxNumber?: string;  // Steuernummer (ej. 12/345/67890)
  iban?: string;
  bic?: string;
  bankName?: string;
  accountHolder?: string;  // Nombre real del titular (obligatorio para SEPA)
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  vatMode: VatMode;
  vatRate: number;
  company: ICompanySettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// Sub-schema: company settings
// ─────────────────────────────────────────────

const CompanySettingsSchema = new Schema<ICompanySettings>(
  {
    name:       { type: String, required: true, trim: true },
    street:     { type: String, required: true, trim: true },
    zip:        { type: String, required: true, trim: true },
    city:       { type: String, required: true, trim: true },
    country:    { type: String, required: true, trim: true, default: "Deutschland" },
    email:      { type: String, trim: true, lowercase: true },
    phone:      { type: String, trim: true },
    taxNumber:  { type: String, trim: true },
    iban:       { type: String, trim: true },
    bic:        { type: String, trim: true },
    bankName:      { type: String, trim: true },
    accountHolder: { type: String, trim: true },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Schema principal
// ─────────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    passwordHash: {
      type:     String,
      required: true,
    },
    vatMode: {
      type:    String,
      enum:    ["kleinunternehmer", "vatRegistered"] satisfies VatMode[],
      default: "kleinunternehmer",
      required: true,
    },
    vatRate: {
      type:    Number,
      default: 19,
      min:     0,
      max:     100,
    },
    company: {
      type:     CompanySettingsSchema,
      required: true,
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
// Pre-save: si vatMode es kleinunternehmer,
// vatRate no es relevante pero lo dejamos en 0
// para evitar confusiones en cálculos futuros
// ─────────────────────────────────────────────

UserSchema.pre("save", function (next) {
  if (this.isModified("vatMode") && this.vatMode === "kleinunternehmer") {
    this.vatRate = 0;
  }
  if (
    this.isModified("vatMode") &&
    this.vatMode === "vatRegistered" &&
    this.vatRate === 0
  ) {
    this.vatRate = 19;
  }
  next();
});

// ─────────────────────────────────────────────
// Índices
// ─────────────────────────────────────────────

UserSchema.index({ isActive: 1 });

// ─────────────────────────────────────────────
// Modelo (singleton para Next.js HMR)
// ─────────────────────────────────────────────

const User: Model<IUser> =
  mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);

export default User;