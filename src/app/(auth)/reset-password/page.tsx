"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password, setPassword]     = useState("");
  const [password2, setPassword2]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!token) setError("Kein Reset-Token angegeben.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Fehler beim Zurücksetzen.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "#1c1c24",
    border: "1px solid #252530",
    borderRadius: "10px",
    padding: "13px 16px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

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

        {success ? (
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
              <div style={{ fontSize: "22px" }}>✅</div>
              <p style={{ color: "#c8f04a", fontWeight: 600, fontSize: "15px", margin: 0 }}>
                Passwort geändert
              </p>
              <p style={{ color: "#888", fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                Ihr Passwort wurde erfolgreich zurückgesetzt.
                Sie werden in Kürze zur Anmeldung weitergeleitet…
              </p>
            </div>
            <p style={{ textAlign: "center", fontSize: "13px", color: "#555", margin: 0 }}>
              <Link href="/login" style={{ color: "#c8f04a", fontWeight: 600, textDecoration: "none" }}>
                Jetzt anmelden →
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
                Neues Passwort
              </h2>
              <p style={{ color: "#666", fontSize: "13px", margin: 0 }}>
                Wählen Sie ein neues Passwort für Ihr Konto.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#555", fontWeight: 500 }}>
                  Neues Passwort
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(200,240,74,0.5)"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "#252530"; }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#555", fontWeight: 500 }}>
                  Passwort bestätigen
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Passwort wiederholen"
                  style={inputStyle}
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
                disabled={loading || !token}
                style={{
                  width: "100%",
                  background: loading ? "#a0c038" : "#c8f04a",
                  color: "#0d1117",
                  fontWeight: 700,
                  fontSize: "15px",
                  borderRadius: "10px",
                  padding: "14px",
                  border: "none",
                  cursor: loading || !token ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "Wird gespeichert…" : "Passwort speichern →"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
