/**
 * Módulo Edge-compatible para verificar sesiones en el middleware.
 * NO importa bcryptjs ni next/headers (incompatibles con Edge runtime).
 */
import { jwtVerify } from "jose";
import { NextRequest } from "next/server";

const COOKIE_NAME   = "ku_session";
const JWT_ISSUER    = "kleinunternehmer-app";
const JWT_AUDIENCE  = "kleinunternehmer-user";

export interface SessionPayload {
  sub:   string;
  email: string;
  iat:   number;
  exp:   number;
}

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

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
