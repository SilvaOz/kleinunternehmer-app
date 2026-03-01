import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register", // ← faltaba esta
];

const PUBLIC_PAGE_ROUTES = ["/login", "/register"];

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|images).*)"],
};

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // ── Permitir API pública ─────────────────────
  if (PUBLIC_API_ROUTES.includes(pathname)) return NextResponse.next();

  // ── Verificar sesión ─────────────────────────
  const session = await getSessionFromRequest(req);

  // ── Si ya hay sesión y visita /login → redirect al dashboard ──
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ── Permitir /login si NO hay sesión ─────────
  if (PUBLIC_PAGE_ROUTES.includes(pathname)) return NextResponse.next();

  // ── API protegida → 401 ──────────────────────
  if (isApi && !session) {
    return NextResponse.json(
      { success: false, error: "Nicht autorisiert" },
      { status: 401 }
    );
  }

  // ── Pages protegidas → redirect ──────────────
  if (!isApi && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export default proxy;