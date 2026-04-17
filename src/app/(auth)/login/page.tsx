"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BULLETS = [
  "Automatische Rechnungsnummern",
  "EÜR-Export für das Finanzamt",
  "PDF-Rechnungen in einem Klick",
  "Storno & Ausgabenverwaltung",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      router.push("/");
    } catch {
      setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#111318",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "920px",
        display: "flex",
        borderRadius: "20px",
        overflow: "hidden",
        border: "1px solid #1e2028",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
      }}>

        {/* ── Panel izquierdo ── */}
        <div style={{
          width: "50%",
          background: "#0d1117",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
        }} className="auth-left-panel">

          {/* Logo */}
          <div>
            <span style={{
              fontFamily: "var(--font-dm-serif)",
              fontSize: "26px",
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}>
              Invoice<span style={{ color: "#c8f04a" }}>OS</span>
            </span>
          </div>

          {/* Texto central */}
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <h1 style={{
                fontFamily: "var(--font-dm-serif)",
                fontSize: "48px",
                lineHeight: "1.1",
                margin: 0,
                color: "#ffffff",
                fontWeight: 400,
              }}>
                Buchhaltung.<br />
                <em style={{
                  color: "#c8f04a",
                  fontStyle: "italic",
                }}>
                  Einfach gemacht.
                </em>
              </h1>
              <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.6", maxWidth: "300px", margin: 0 }}>
                Rechnungen, Ausgaben und EÜR für<br />Kleinunternehmer nach §19 UStG.
              </p>
            </div>

            {/* Bullets */}
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              {BULLETS.map((b) => (
                <li key={b} style={{ display: "flex", alignItems: "center", gap: "10px", color: "#aaa", fontSize: "13px" }}>
                  <span style={{ color: "#c8f04a", fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>•</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <p style={{ color: "#333", fontSize: "11px", margin: 0 }}>
            © {new Date().getFullYear()} InvoiceOS
          </p>
        </div>

        {/* ── Panel derecho ── */}
        <div style={{
          flex: 1,
          background: "#16161c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 40px",
        }}>
          <div style={{ width: "100%", maxWidth: "340px", display: "flex", flexDirection: "column", gap: "32px" }}>

            {/* Encabezado */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <h2 style={{
                fontFamily: "var(--font-dm-serif)",
                fontSize: "32px",
                fontWeight: 400,
                color: "#ffffff",
                margin: 0,
                lineHeight: 1.2,
              }}>
                Willkommen zurück
              </h2>
              <p style={{ color: "#666", fontSize: "13px", margin: 0 }}>
                Melden Sie sich in Ihrem Konto an
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#555", fontWeight: 500 }}>
                  E-Mail
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@firma.de"
                  style={{
                    background: "#1c1c24",
                    border: "1px solid #252530",
                    borderRadius: "10px",
                    padding: "13px 16px",
                    color: "#fff",
                    fontSize: "14px",
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(200,240,74,0.5)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#252530"; }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#555", fontWeight: 500 }}>
                  Passwort
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  style={{
                    background: "#1c1c24",
                    border: "1px solid #252530",
                    borderRadius: "10px",
                    padding: "13px 16px",
                    color: "#fff",
                    fontSize: "14px",
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(200,240,74,0.5)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#252530"; }}
                />
              </div>

              <div style={{ textAlign: "right" }}>
                <Link
                  href="/forgot-password"
                  style={{ color: "#888", fontSize: "12px", textDecoration: "none" }}
                >
                  Passwort vergessen?
                </Link>
              </div>

              {error && (
                <p style={{
                  color: "#f87171",
                  fontSize: "13px",
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  margin: 0,
                }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  background: loading ? "#a0c038" : "#c8f04a",
                  color: "#0d1117",
                  fontWeight: 700,
                  fontSize: "15px",
                  borderRadius: "10px",
                  padding: "14px",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  letterSpacing: "0.01em",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "Wird angemeldet…" : "Anmelden →"}
              </button>
            </form>

            {/* Separador */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, height: "1px", background: "#222228" }} />
              <span style={{ color: "#333", fontSize: "11px" }}>oder</span>
              <div style={{ flex: 1, height: "1px", background: "#222228" }} />
            </div>

            {/* Registro */}
            <p style={{ textAlign: "center", fontSize: "13px", color: "#555", margin: 0 }}>
              Noch kein Konto?{" "}
              <Link
                href="/register"
                style={{ color: "#c8f04a", fontWeight: 600, textDecoration: "none" }}
              >
                Jetzt registrieren
              </Link>
            </p>

          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 768px) {
          .auth-left-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
