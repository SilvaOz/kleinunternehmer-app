import { z } from "zod";

// ─────────────────────────────────────────────
// Helpers compartidos
// ─────────────────────────────────────────────

const nonEmptyString = z
  .string()
  .trim()
  .min(1, "Pflichtfeld");

// Normaliza string vacío o ausente → undefined
const optionalString = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

const positiveNumber = z
  .number()
  .min(0, "Muss >= 0 sein");

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────

const CompanySchema = z.object({
  name: nonEmptyString,
  street: nonEmptyString,
  zip: nonEmptyString,
  city: nonEmptyString,
  country: z.string().trim().min(1).default("Deutschland"),
  email: z.string().trim().email("Ungültige E-Mail").optional(),
  phone: optionalString,
  taxNumber: optionalString,
  iban: optionalString,
  bic: optionalString,
  bankName: optionalString,
  accountHolder: optionalString,
});

export const UserRegisterSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Ungültige E-Mail"),
    password: z
      .string()
      .min(10, "Passwort muss mindestens 10 Zeichen haben"),
    vatMode: z
      .enum(["kleinunternehmer", "vatRegistered"])
      .default("kleinunternehmer"),
    vatRate: z.number().min(0).max(100).optional(),
    company: CompanySchema,
  })
  .transform((data) => ({
    ...data,
    // Si kleinunternehmer → vatRate irrelevante, forzar 0
    // Si vatRegistered y no se provee → default 19
    vatRate:
      data.vatMode === "kleinunternehmer"
        ? 0
        : (data.vatRate ?? 19),
  }));

export const UserLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail"),
  password: z.string().min(1, "Pflichtfeld"),
});

export type UserRegisterInput = z.infer<typeof UserRegisterSchema>;
export type UserLoginInput = z.infer<typeof UserLoginSchema>;

// ─────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────

const ClientBaseSchema = z
  .object({
    companyName: optionalString,
    contactName: optionalString,
    street: nonEmptyString,
    zip: nonEmptyString,
    city: nonEmptyString,
    country: z.string().trim().min(1).default("Deutschland"),
    email: z.string().trim().email("Ungültige E-Mail").optional(),
    phone: optionalString,
    notes: optionalString,
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) =>
      (data.companyName !== undefined && data.companyName.length > 0) ||
      (data.contactName !== undefined && data.contactName.length > 0),
    {
      message: "Es muss mindestens companyName oder contactName angegeben werden.",
      path: ["companyName"],
    }
  );

export const ClientCreateSchema = ClientBaseSchema;

export const ClientUpdateSchema = z
  .object({
    companyName: optionalString,
    contactName: optionalString,
    street: optionalString,
    zip: optionalString,
    city: optionalString,
    country: optionalString,
    email: z.string().trim().email("Ungültige E-Mail").optional(),
    phone: optionalString,
    notes: optionalString,
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.companyName === undefined && data.contactName === undefined) {
        return true; // update parcial, no tocamos estos campos
      }
      const hasCompany = data.companyName !== undefined && data.companyName.length > 0;
      const hasContact = data.contactName !== undefined && data.contactName.length > 0;
      return hasCompany || hasContact;
    },
    {
      message: "Es muss mindestens companyName oder contactName angegeben werden.",
      path: ["companyName"],
    }
  );

export type ClientCreateInput = z.infer<typeof ClientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof ClientUpdateSchema>;

// ─────────────────────────────────────────────
// EXPENSE
// ─────────────────────────────────────────────

const ExpenseCategoryEnum = z.enum([
  "software",
  "hardware",
  "office",
  "training",
  "travel",
  "hosting",
  "services",
  "other",
]);

export type ExpenseCategory = z.infer<typeof ExpenseCategoryEnum>;

const ExpenseBaseSchema = z.object({
  date: z.coerce.date(),
  vendor: optionalString,
  description: nonEmptyString,
  category: ExpenseCategoryEnum,
  amountGross: positiveNumber,
  businessUsePct: z.number().min(0).max(100).default(100),
  paid: z.boolean().default(true),
  paidAt: z.coerce.date().optional(),
  receipt: z
    .object({
      url: optionalString,
      sha256: optionalString,
    })
    .optional(),
  notes: optionalString,
});

export const ExpenseCreateSchema = ExpenseBaseSchema;

export const ExpenseUpdateSchema = z.object({
  date: z.coerce.date().optional(),
  vendor: optionalString,
  description: optionalString,
  category: ExpenseCategoryEnum.optional(),
  amountGross: positiveNumber.optional(),
  businessUsePct: z.number().min(0).max(100).optional(),
  paid: z.boolean().optional(),
  paidAt: z.coerce.date().optional(),
  receipt: z
    .object({
      url: optionalString,
      sha256: optionalString,
    })
    .optional(),
  notes: optionalString,
});

export type ExpenseCreateInput = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof ExpenseUpdateSchema>;

// ─────────────────────────────────────────────
// INVOICE ITEMS
// ─────────────────────────────────────────────

const InvoiceItemSchema = z.object({
  title: nonEmptyString,
  lines: z.array(z.string().trim()).optional(),
  qty: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0, "unitPrice muss >= 0 sein"),
});

export type InvoiceItemInput = z.infer<typeof InvoiceItemSchema>;

// ─────────────────────────────────────────────
// INVOICE DRAFT CREATE / UPDATE
// ─────────────────────────────────────────────

export const InvoiceDraftCreateSchema = z.object({
  clientId: z.string().trim().min(1, "clientId erforderlich").optional(),
  items: z.array(InvoiceItemSchema).min(1, "Mindestens eine Position erforderlich"),
  dueAt: z.coerce.date().optional(),
  footerText: optionalString,
});

export const InvoiceDraftUpdateSchema = z.object({
  clientId: z.string().trim().min(1).optional(),
  items: z.array(InvoiceItemSchema).min(1).optional(),
  dueAt: z.coerce.date().optional(),
  footerText: optionalString,
});

export type InvoiceDraftCreateInput = z.infer<typeof InvoiceDraftCreateSchema>;
export type InvoiceDraftUpdateInput = z.infer<typeof InvoiceDraftUpdateSchema>;

// ─────────────────────────────────────────────
// INVOICE ISSUE
// (clientSnapshot obligatorio al emitir)
// ─────────────────────────────────────────────

export const ClientSnapshotSchema = z
  .object({
    companyName: optionalString,
    contactName: optionalString,
    street: nonEmptyString,
    zip: nonEmptyString,
    city: nonEmptyString,
    country: z.string().trim().min(1).default("Deutschland"),
    email: z.string().trim().email().optional(),
    phone: optionalString,
  })
  .refine(
    (data) =>
      (data.companyName !== undefined && data.companyName.length > 0) ||
      (data.contactName !== undefined && data.contactName.length > 0),
    {
      message: "clientSnapshot muss companyName oder contactName enthalten.",
      path: ["companyName"],
    }
  );

export const InvoiceIssueSchema = z.object({
  dueAt: z.coerce.date().optional(),
  clientSnapshot: ClientSnapshotSchema.optional(), // ✅ ahora opcional
});

export type InvoiceIssueInput = z.infer<typeof InvoiceIssueSchema>;
export type ClientSnapshotInput = z.infer<typeof ClientSnapshotSchema>;