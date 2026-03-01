import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

const COOKIE_NAME    = "ku_session";
const JWT_ISSUER     = "kleinunternehmer-app";
const JWT_AUDIENCE   = "kleinunternehmer-user";
const BCRYPT_ROUNDS  = 12;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";

if (!process.env.JWT_SECRET) {
  throw new Error("Por favor define JWT_SECRET en .env.local");
}

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface SessionPayload {
  sub:   string;
  email: string;
  iat:   number;
  exp:   number;
}

// ─────────────────────────────────────────────
// JWT
// ─────────────────────────────────────────────

export async function signToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer:   JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export async function createSession(
  cookieStore: CookieStore,
  userId: string,
  email: string
): Promise<void> {
  const token = await signToken(userId, email);
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   parseExpiresIn(JWT_EXPIRES_IN),
  });
}

export function destroySession(cookieStore: CookieStore): void {
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   0,
  });
}

// ─────────────────────────────────────────────
// getSession — Server Components
// ─────────────────────────────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies(); // ← await para Next.js 15/16
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─────────────────────────────────────────────
// getSessionFromRequest — Edge-safe, middleware
// ─────────────────────────────────────────────

export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─────────────────────────────────────────────
// getOwnerIdFromCookies — helper para API routes
// ─────────────────────────────────────────────

export async function getOwnerIdFromCookies(): Promise<string | null> {
  const session = await getSession();
  return session?.sub ?? null;
}

// ─────────────────────────────────────────────
// bcryptjs helpers
// ─────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─────────────────────────────────────────────
// Utilidad: parsear "8h" | "24h" | "7d" → segundos
// ─────────────────────────────────────────────

function parseExpiresIn(exp: string): number {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) return 60 * 60 * 8;
  const value = parseInt(match[1], 10);
  const unit  = match[2];
  switch (unit) {
    case "s": return value;
    case "m": return value * 60;
    case "h": return value * 60 * 60;
    case "d": return value * 60 * 60 * 24;
    default:  return 60 * 60 * 8;
  }
}