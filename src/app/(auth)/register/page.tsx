"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BULLETS = [
  "Kostenlos & ohne Kreditkarte",
  "Sofort einsatzbereit",
  "DSGVO-konform in Deutschland",
  "Keine versteckten Kosten",
];

type Step = 1 | 2;

interface FormData {
  email: string;
  password: string;
  passwordConfirm: string;
  companyName: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  taxNumber: string;
  iban: string;
  bic: string;
  bankName: string;
}

const EMPTY: FormData = {
  email: "", password: "", passwordConfirm: "",
  companyName: "", street: "", zip: "", city: "Berlin",
  country: "Deutschland", taxNumber: "", iban: "", bic: "", bankName: "",
};

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

function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...props.style }}
      onFocus={(e) => { e.target.style.borderColor = "rgba(200,240,74,0.5)"; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = "#252530"; props.onBlur?.(e); }}
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#555", fontWeight: 500, display: "block", marginBottom: "6px" }}>
      {children}
    </label>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setError("");
    };
  }

  function validateStep1(): string {
    if (!form.email.trim()) return "E-Mail ist erforderlich.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Ungültige E-Mail-Adresse.";
    if (form.password.length < 10) return "Passwort muss mindestens 10 Zeichen haben.";
    if (form.password !== form.passwordConfirm) return "Passwörter stimmen nicht überein.";
    return "";
  }

  function validateStep2(): string {
    if (!form.companyName.trim()) return "Unternehmensname ist erforderlich.";
    if (!form.street.trim()) return "Straße ist erforderlich.";
    if (!form.zip.trim()) return "PLZ ist erforderlich.";
    if (!form.city.trim()) return "Stadt ist erforderlich.";
    return "";
  }

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError("");
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep2();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          vatMode: "kleinunternehmer",
          company: {
            name: form.companyName,
            street: form.street,
            zip: form.zip,
            city: form.city,
            country: form.country || "Deutschland",
            taxNumber: form.taxNumber || undefined,
            iban: form.iban || undefined,
            bic: form.bic || undefined,
            bankName: form.bankName || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Registrierung fehlgeschlagen.");
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
                In 2 Minuten<br />
                <em style={{ color: "#c8f04a", fontStyle: "italic" }}>
                  startklar.
                </em>
              </h1>
              <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.6", maxWidth: "300px", margin: 0 }}>
                Erstellen Sie Ihr Konto und verwalten Sie Rechnungen, Ausgaben und EÜR als Kleinunternehmer nach §19 UStG.
              </p>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              {BULLETS.map((b) => (
                <li key={b} style={{ display: "flex", alignItems: "center", gap: "10px", color: "#aaa", fontSize: "13px" }}>
                  <span style={{ color: "#c8f04a", fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>•</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

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
          <div style={{ width: "100%", maxWidth: "340px", display: "flex", flexDirection: "column", gap: "28px" }}>

            {/* Encabezado + step indicator */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h2 style={{
                  fontFamily: "var(--font-dm-serif)",
                  fontSize: "32px",
                  fontWeight: 400,
                  color: "#ffffff",
                  margin: 0,
                  lineHeight: 1.2,
                }}>
                  Konto erstellen
                </h2>
                <p style={{ color: "#666", fontSize: "13px", margin: 0 }}>
                  {step === 1 ? "E-Mail und Passwort festlegen" : "Wo sind Sie ansässig?"}
                </p>
              </div>

              {/* Step dots */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ height: "4px", borderRadius: "2px", background: "#c8f04a", width: step === 1 ? "32px" : "16px", transition: "width 0.3s" }} />
                <div style={{ height: "4px", borderRadius: "2px", background: step === 2 ? "#c8f04a" : "#222228", width: step === 2 ? "32px" : "16px", transition: "width 0.3s, background 0.3s" }} />
                <span style={{ color: "#333", fontSize: "11px", marginLeft: "4px" }}>Schritt {step} von 2</span>
              </div>
            </div>

            {/* ── Step 1 ── */}
            {step === 1 && (
              <form onSubmit={handleNextStep} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <FieldLabel>E-Mail</FieldLabel>
                  <AuthInput type="email" autoComplete="email" placeholder="name@firma.de" value={form.email} onChange={set("email")} required />
                </div>
                <div>
                  <FieldLabel>Passwort <span style={{ color: "#333", fontStyle: "normal", textTransform: "none", letterSpacing: 0, fontSize: "10px" }}>(min. 10 Zeichen)</span></FieldLabel>
                  <AuthInput type="password" autoComplete="new-password" placeholder="••••••••••" value={form.password} onChange={set("password")} required />
                </div>
                <div>
                  <FieldLabel>Passwort wiederholen</FieldLabel>
                  <AuthInput type="password" autoComplete="new-password" placeholder="••••••••••" value={form.passwordConfirm} onChange={set("passwordConfirm")} required />
                </div>

                {error && (
                  <p style={{ color: "#f87171", fontSize: "13px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "12px 16px", margin: 0 }}>
                    {error}
                  </p>
                )}

                <button type="submit" style={{ width: "100%", background: "#c8f04a", color: "#0d1117", fontWeight: 700, fontSize: "15px", borderRadius: "10px", padding: "14px", border: "none", cursor: "pointer" }}>
                  Weiter →
                </button>
              </form>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <FieldLabel>Name des Unternehmens</FieldLabel>
                  <AuthInput type="text" placeholder="z. B. Max Mustermann Webdesign" value={form.companyName} onChange={set("companyName")} required />
                </div>
                <div>
                  <FieldLabel>Adresse</FieldLabel>
                  <AuthInput type="text" placeholder="Musterstraße 1" value={form.street} onChange={set("street")} required />
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ width: "110px", flexShrink: 0 }}>
                    <FieldLabel>PLZ</FieldLabel>
                    <AuthInput type="text" placeholder="10115" value={form.zip} onChange={set("zip")} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>Stadt</FieldLabel>
                    <AuthInput type="text" placeholder="Berlin" value={form.city} onChange={set("city")} required />
                  </div>
                </div>

                <div style={{ paddingTop: "8px", borderTop: "1px solid #1e1e28" }}>
                  <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#333", marginBottom: "10px", marginTop: 0 }}>
                    Bankdaten & Steuer (optional)
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <AuthInput type="text" placeholder="Steuernummer (z. B. 12/345/67890)" value={form.taxNumber} onChange={set("taxNumber")} />
                    <AuthInput type="text" placeholder="IBAN" value={form.iban} onChange={set("iban")} />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <AuthInput type="text" placeholder="BIC" value={form.bic} onChange={set("bic")} />
                      <AuthInput type="text" placeholder="Bankname" value={form.bankName} onChange={set("bankName")} />
                    </div>
                  </div>
                </div>

                {error && (
                  <p style={{ color: "#f87171", fontSize: "13px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "12px 16px", margin: 0 }}>
                    {error}
                  </p>
                )}

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(""); }}
                    style={{ width: "90px", flexShrink: 0, background: "#1c1c24", color: "#888", fontWeight: 500, fontSize: "14px", borderRadius: "10px", padding: "14px", border: "1px solid #252530", cursor: "pointer" }}
                  >
                    ← Zurück
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ flex: 1, background: loading ? "#a0c038" : "#c8f04a", color: "#0d1117", fontWeight: 700, fontSize: "15px", borderRadius: "10px", padding: "14px", border: "none", cursor: loading ? "not-allowed" : "pointer" }}
                  >
                    {loading ? "Wird erstellt…" : "Konto erstellen →"}
                  </button>
                </div>
              </form>
            )}

            {/* Separador + link */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ flex: 1, height: "1px", background: "#222228" }} />
                <span style={{ color: "#333", fontSize: "11px" }}>oder</span>
                <div style={{ flex: 1, height: "1px", background: "#222228" }} />
              </div>
              <p style={{ textAlign: "center", fontSize: "13px", color: "#555", margin: 0 }}>
                Bereits ein Konto?{" "}
                <Link href="/login" style={{ color: "#c8f04a", fontWeight: 600, textDecoration: "none" }}>
                  Jetzt anmelden
                </Link>
              </p>
            </div>

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
