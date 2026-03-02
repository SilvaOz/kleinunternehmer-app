import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Por favor define MONGODB_URI en .env.local"
  );
}

/**
 * Singleton de conexión para Next.js.
 * En desarrollo, Next.js recarga módulos frecuentemente (HMR),
 * por lo que guardamos la promesa de conexión en el objeto global
 * para evitar abrir múltiples conexiones.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global._mongooseCache) {
  global._mongooseCache = cache;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
    });
  }

  try {
    cache.conn = await cache.promise;
    // Eliminar índice obsoleto (sparse → partialFilterExpression).
    // Idempotente: ignora si el índice ya no existe.
    cache.conn.connection.db
      ?.collection("invoices")
      .dropIndex("ownerId_1_stornoOf_1")
      .catch(() => {});
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}