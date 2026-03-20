"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./settings.module.css";

// ── Types ─────────────────────────────────────
type UserData = {
  email: string;
  vatMode: string;
  company: {
    name: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    email?: string;
    phone?: string;
    taxNumber?: string;
    iban?: string;
    bic?: string;
    bankName?: string;
    accountHolder?: string;
  };
};

// ── Small helpers ──────────────────────────────
function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        className={styles.fieldInput}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <div className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</div>;
}

// ── Page ──────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Section 1 — Profil
  const [firma, setFirma] = useState({
    name: "", street: "", zip: "", city: "", country: "Deutschland",
    phone: "", email: "", taxNumber: "", iban: "", bic: "", bankName: "", accountHolder: "",
  });
  const [savingFirma, setSavingFirma] = useState(false);
  const [firmaMsg, setFirmaMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Section 1b — Rechnungsnummer counter
  const currentYear = new Date().getFullYear();
  const [counterYear]               = useState(currentYear);
  const [counterCurrent, setCounterCurrent]   = useState(0);   // sequence loaded from DB
  const [counterInput, setCounterInput]       = useState("");   // what user types (next number they want)
  const [savingCounter, setSavingCounter]     = useState(false);
  const [counterMsg, setCounterMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [counterLoaded, setCounterLoaded]     = useState(false);

  // Section 2 — Password
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Section 3 — Delete account modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const deleteInputRef = useRef<HTMLInputElement>(null);

  // Load user + counter
  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch(`/api/counter?year=${currentYear}`).then((r) => r.json()),
    ])
      .then(([userRes, counterRes]) => {
        if (userRes.success && userRes.data) {
          setUser(userRes.data);
          const c = userRes.data.company ?? {};
          setFirma({
            name:       c.name       ?? "",
            street:     c.street     ?? "",
            zip:        c.zip        ?? "",
            city:       c.city       ?? "",
            country:    c.country    ?? "Deutschland",
            phone:      c.phone      ?? "",
            email:      c.email      ?? "",
            taxNumber:  c.taxNumber  ?? "",
            iban:          c.iban          ?? "",
            bic:           c.bic           ?? "",
            bankName:      c.bankName      ?? "",
            accountHolder: c.accountHolder ?? "",
          });
        }
        if (counterRes.success) {
          setCounterCurrent(counterRes.sequence);
          setCounterLoaded(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentYear]);

  // Focus delete input when modal opens
  useEffect(() => {
    if (showDelete) {
      setDeleteEmail("");
      setDeleteMsg(null);
      setTimeout(() => deleteInputRef.current?.focus(), 50);
    }
  }, [showDelete]);

  // ── Section 1: save Profil ──
  async function handleSaveFirma(e: React.FormEvent) {
    e.preventDefault();
    setSavingFirma(true);
    setFirmaMsg(null);
    const res = await fetch("/api/auth/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: firma }),
    }).then((r) => r.json());
    setSavingFirma(false);
    setFirmaMsg(res.success
      ? { ok: true,  text: "Daten gespeichert." }
      : { ok: false, text: res.error ?? "Fehler beim Speichern." });
  }

  // ── Section 2: change password ──
  async function handleSavePwd(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ ok: false, text: "Passwörter stimmen nicht überein." });
      return;
    }
    if (pwd.next.length < 10) {
      setPwdMsg({ ok: false, text: "Neues Passwort muss mindestens 10 Zeichen haben." });
      return;
    }
    setSavingPwd(true);
    setPwdMsg(null);
    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }),
    }).then((r) => r.json());
    setSavingPwd(false);
    if (res.success) {
      setPwdMsg({ ok: true, text: "Passwort erfolgreich geändert." });
      setPwd({ current: "", next: "", confirm: "" });
    } else {
      setPwdMsg({ ok: false, text: res.error ?? "Fehler." });
    }
  }

  // ── Section 3: delete account ──
  async function handleDeleteAccount() {
    if (deleteEmail !== user?.email) return;
    setDeleting(true);
    setDeleteMsg(null);
    const res = await fetch("/api/auth/account", { method: "DELETE" }).then((r) => r.json());
    if (res.success) {
      router.push("/login");
    } else {
      setDeleting(false);
      setDeleteMsg({ ok: false, text: res.error ?? "Fehler beim Löschen." });
    }
  }

  // ── Section 1b: save counter ──
  async function handleSaveCounter(e: React.FormEvent) {
    e.preventDefault();
    const next = parseInt(counterInput, 10);
    if (isNaN(next) || next < 1) {
      setCounterMsg({ ok: false, text: "Bitte eine gültige Zahl ≥ 1 eingeben." });
      return;
    }
    // We store sequence = next - 1 (last used), so the next invoice gets `next`
    const newSequence = next - 1;
    setSavingCounter(true);
    setCounterMsg(null);
    const res = await fetch("/api/counter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: counterYear, sequence: newSequence }),
    }).then((r) => r.json());
    setSavingCounter(false);
    if (res.success) {
      setCounterCurrent(res.sequence);
      setCounterInput("");
      setCounterMsg({ ok: true, text: `Zähler gesetzt. Nächste Rechnung: ${counterYear}-${String(res.sequence + 1).padStart(4, "0")}` });
    } else {
      setCounterMsg({ ok: false, text: res.error ?? "Fehler." });
    }
  }

  function setF(k: keyof typeof firma, v: string) {
    setFirma((f) => ({ ...f, [k]: v }));
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.pageLabel}>EINSTELLUNGEN</div>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pageLabel}>EINSTELLUNGEN</div>

      <div className={styles.sections}>

        {/* ── Section 1: Profil & Unternehmen ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Profil &amp; Unternehmen</div>
            {user && (
              <span className={styles.emailTag}>{user.email}</span>
            )}
          </div>
          <form onSubmit={handleSaveFirma} className={styles.form}>
            <div className={styles.formGrid}>
              <div className={styles.colFull}>
                <Field label="FIRMENNAME" value={firma.name} onChange={(v) => setF("name", v)} placeholder="Muster GmbH" />
              </div>
              <Field label="STRASSE" value={firma.street} onChange={(v) => setF("street", v)} placeholder="Musterstraße 1" />
              <Field label="PLZ" value={firma.zip} onChange={(v) => setF("zip", v)} placeholder="80331" />
              <Field label="STADT" value={firma.city} onChange={(v) => setF("city", v)} placeholder="München" />
              <Field label="LAND" value={firma.country} onChange={(v) => setF("country", v)} />
              <Field label="STEUERNUMMER" value={firma.taxNumber ?? ""} onChange={(v) => setF("taxNumber", v)} placeholder="12/345/67890" />
              <Field label="TELEFON" value={firma.phone ?? ""} onChange={(v) => setF("phone", v)} placeholder="+49 89 123456" />
              <div className={styles.colFull}>
                <div className={styles.dividerLabel}>Bankverbindung</div>
              </div>
              <div className={styles.colFull}>
                <Field label="KONTOINHABER (vollständiger Name wie auf der Karte)" value={firma.accountHolder ?? ""} onChange={(v) => setF("accountHolder", v)} placeholder="z.B. Maria Muster" />
              </div>
              <div className={styles.colFull}>
                <Field label="IBAN" value={firma.iban ?? ""} onChange={(v) => setF("iban", v)} placeholder="DE89 3704 0044 0532 0130 00" />
              </div>
              <Field label="BIC" value={firma.bic ?? ""} onChange={(v) => setF("bic", v)} placeholder="COBADEFFXXX" />
              <Field label="BANKNAME" value={firma.bankName ?? ""} onChange={(v) => setF("bankName", v)} placeholder="Commerzbank" />
            </div>
            <Msg msg={firmaMsg} />
            <div className={styles.formFooter}>
              <button type="submit" className={styles.btnSave} disabled={savingFirma}>
                {savingFirma ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Section 1b: Rechnungsnummer ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Rechnungsnummer</div>
            {counterLoaded && (
              <span className={styles.emailTag}>
                aktuell: {counterCurrent === 0 ? "–" : `${counterYear}-${String(counterCurrent).padStart(4, "0")}`}
              </span>
            )}
          </div>
          <form onSubmit={handleSaveCounter} className={styles.form}>
            <p style={{ margin: 0, fontSize: 13, color: "#666", lineHeight: 1.6 }}>
              Legt fest, welche Nummer die <strong style={{ color: "#aaa" }}>nächste</strong> ausgestellte
              Rechnung erhalten soll. Nützlich beim Umstieg von manueller Nummerierung.
            </p>
            <div className={styles.formGrid}>
              <div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>NÄCHSTE RECHNUNGSNUMMER</label>
                  <input
                    className={styles.fieldInput}
                    type="number"
                    min={1}
                    value={counterInput}
                    onChange={(e) => { setCounterInput(e.target.value); setCounterMsg(null); }}
                    placeholder={`z. B. ${counterCurrent + 2}`}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 1 }}>
                {counterInput && parseInt(counterInput, 10) >= 1 ? (
                  <div style={{
                    background: "#0d0d12", border: "1px solid #2a2a36", borderRadius: 8,
                    padding: "10px 14px", width: "100%", boxSizing: "border-box" as const,
                  }}>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono, monospace", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 4 }}>
                      VORSCHAU
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#c8f04a", fontFamily: "DM Mono, monospace" }}>
                      {counterYear}-{String(parseInt(counterInput, 10)).padStart(4, "0")}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: "#0d0d12", border: "1px solid #1e1e2a", borderRadius: 8,
                    padding: "10px 14px", width: "100%", boxSizing: "border-box" as const,
                  }}>
                    <div style={{ fontSize: 10, color: "#333", fontFamily: "DM Mono, monospace", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 4 }}>
                      VORSCHAU
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#333", fontFamily: "DM Mono, monospace" }}>
                      {counterYear}-????
                    </div>
                  </div>
                )}
              </div>
            </div>
            {counterInput && parseInt(counterInput, 10) <= counterCurrent && (
              <div className={styles.msgErr} style={{ fontSize: 11 }}>
                ⚠ Diese Zahl liegt unter dem aktuellen Zählerstand ({counterCurrent}).
                Das kann zu doppelten Nummern führen.
              </div>
            )}
            <Msg msg={counterMsg} />
            <div className={styles.formFooter}>
              <button
                type="submit"
                className={styles.btnSave}
                disabled={savingCounter || !counterInput || parseInt(counterInput, 10) < 1}
              >
                {savingCounter ? "Speichern…" : "Zähler setzen"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Section 2: Passwort ändern ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Passwort ändern</div>
          </div>
          <form onSubmit={handleSavePwd} className={styles.form}>
            <div className={styles.formGrid}>
              <div className={styles.colFull}>
                <Field label="AKTUELLES PASSWORT" value={pwd.current} onChange={(v) => setPwd((p) => ({ ...p, current: v }))} type="password" placeholder="••••••••••" />
              </div>
              <Field label="NEUES PASSWORT" value={pwd.next} onChange={(v) => setPwd((p) => ({ ...p, next: v }))} type="password" placeholder="Min. 10 Zeichen" />
              <Field label="PASSWORT WIEDERHOLEN" value={pwd.confirm} onChange={(v) => setPwd((p) => ({ ...p, confirm: v }))} type="password" placeholder="••••••••••" />
            </div>
            <Msg msg={pwdMsg} />
            <div className={styles.formFooter}>
              <button type="submit" className={styles.btnSave} disabled={savingPwd || !pwd.current || !pwd.next}>
                {savingPwd ? "Ändern…" : "Passwort ändern"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Section 3: Konto löschen ── */}
        <div className={`${styles.card} ${styles.cardDanger}`}>
          <div className={styles.cardHeader}>
            <div className={`${styles.cardTitle} ${styles.dangerTitle}`}>Konto löschen</div>
          </div>
          <div className={styles.dangerBody}>
            <p className={styles.dangerText}>
              Diese Aktion ist <strong>unwiderruflich</strong>. Alle Ihre Daten werden dauerhaft
              gelöscht — Rechnungen, Kunden, Ausgaben und Ihr Benutzerkonto.
            </p>
            <button className={styles.btnDanger} onClick={() => setShowDelete(true)}>
              Konto löschen
            </button>
          </div>
        </div>

      </div>

      {/* ── Delete confirmation modal ── */}
      {showDelete && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowDelete(false)}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Konto endgültig löschen?</div>
            <p className={styles.modalText}>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Rechnungen,
              Kunden, Ausgaben und Ihr Konto werden dauerhaft gelöscht.
            </p>
            <p className={styles.modalText}>
              Geben Sie Ihre E-Mail-Adresse ein, um zu bestätigen:
              <strong style={{ color: "#e6e6e6" }}> {user?.email}</strong>
            </p>
            <input
              ref={deleteInputRef}
              className={styles.fieldInput}
              type="email"
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              placeholder={user?.email}
              autoComplete="off"
            />
            <Msg msg={deleteMsg} />
            <div className={styles.modalActions}>
              <button
                className={styles.btnCancel}
                onClick={() => setShowDelete(false)}
                disabled={deleting}
              >
                Abbrechen
              </button>
              <button
                className={styles.btnConfirmDelete}
                onClick={handleDeleteAccount}
                disabled={deleteEmail !== user?.email || deleting}
              >
                {deleting ? "Löschen…" : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
