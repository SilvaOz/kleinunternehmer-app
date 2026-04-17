"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Senden.");
        return;
      }
      setSent(true);
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
        maxWidth: "400px",
        background: "#16161c",
        borderRadius: "20px",
        border: "1px solid #1e2028",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        padding: "48px 40px",
        display: "flex",
        flexDirection: "column",
        gap: "32px",
      }}>

        {/* Logo */}
        <Link href="/login" style={{ textDecoration: "none" }}>
          <span style={{
            fontFamily: "var(--font-dm-serif)",
            fontSize: "22px",
            color: "#ffffff",
            letterSpacing: "-0.5px",
          }}>
            Invoice<span style={{ color: "#c8f04a" }}>OS</span>
          </span>
        </Link>

        {sent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              background: "rgba(200,240,74,0.08)",
              border: "1px solid rgba(200,240,74,0.25)",
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}>
              <div style={{ fontSize: "22px" }}>✉️</div>
              <p style={{ color: "#c8f04a", fontWeight: 600, fontSize: "15px", margin: 0 }}>
                E-Mail gesendet
              </p>
              <p style={{ color: "#888", fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                Falls ein Konto mit dieser E-Mail-Adresse existiert, haben Sie einen
                Link zum Zurücksetzen des Passworts erhalten. Bitte überprüfen Sie
                auch Ihren Spam-Ordner.
              </p>
            </div>
            <p style={{ textAlign: "center", fontSize: "13px", color: "#555", margin: 0 }}>
              <Link href="/login" style={{ color: "#c8f04a", fontWeight: 600, textDecoration: "none" }}>
                ← Zurück zur Anmeldung
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <h2 style={{
                fontFamily: "var(--font-dm-serif)",
                fontSize: "28px",
                fontWeight: 400,
                color: "#ffffff",
                margin: 0,
                lineHeight: 1.2,
              }}>
                Passwort vergessen?
              </h2>
              <p style={{ color: "#666", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
                Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link
                zum Zurücksetzen des Passworts.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#555", fontWeight: 500 }}>
                  E-Mail
                </label>
                <input
                  type="email"
                  required
                  autoFocus
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
                  onBlur={(e)  => { e.target.style.borderColor = "#252530"; }}
                />
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
                  transition: "background 0.15s",
                }}
              >
                {loading ? "Wird gesendet…" : "Link senden →"}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: "13px", color: "#555", margin: 0 }}>
              <Link href="/login" style={{ color: "#666", textDecoration: "none" }}>
                ← Zurück zur Anmeldung
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
