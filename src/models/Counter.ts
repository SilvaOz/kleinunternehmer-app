import mongoose, { Document, Model, Schema } from "mongoose";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface ICounter extends Document {
  ownerId: mongoose.Types.ObjectId;
  year: number;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CounterModel extends Model<ICounter> {
  nextSequence(ownerId: string, year: number): Promise<number>;
}

// ─────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────

const CounterSchema = new Schema<ICounter, CounterModel>(
  {
    ownerId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    year: {
      type:     Number,
      required: true,
    },
    sequence: {
      type:     Number,
      required: true,
      default:  0,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
// Índice único por usuario + año
// Garantiza secuencias independientes por usuario
// ─────────────────────────────────────────────

CounterSchema.index({ ownerId: 1, year: 1 }, { unique: true });

// ─────────────────────────────────────────────
// Método estático: incremento atómico
// Devuelve el NUEVO valor de sequence (post-increment)
// ─────────────────────────────────────────────

CounterSchema.statics.nextSequence = async function (
  ownerId: string,
  year: number
): Promise<number> {
  const doc = await this.findOneAndUpdate(
    {
      ownerId: new mongoose.Types.ObjectId(ownerId),
      year,
    },
    { $inc: { sequence: 1 } },
    {
      new:                true,
      upsert:             true,
      setDefaultsOnInsert: true,
    }
  );

  return doc.sequence;
};

// ─────────────────────────────────────────────
// Utilidad: formatear número de factura
// Ejemplo: year=2026, sequence=1 → "2026-001"
// ─────────────────────────────────────────────

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(3, "0")}`;
}

// ─────────────────────────────────────────────
// Modelo (singleton para Next.js HMR)
// ─────────────────────────────────────────────

const Counter =
  (mongoose.models.Counter as CounterModel) ||
  mongoose.model<ICounter, CounterModel>("Counter", CounterSchema);

export default Counter;