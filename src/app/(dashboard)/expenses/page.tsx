"use client";
import { useState, useEffect, useRef } from "react";
import styles from "./expenses.module.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const CAT_COLOR: Record<string, string> = {
  software: "#4a6ef5",
  hardware: "#7b5cf0",
  office:   "#c8f04a",
  training: "#9b5cf5",
  travel:   "#f0952d",
  hosting:  "#0dd3b8",
  services: "#f0215d",
  other:    "#666",
};
const CAT_LABEL: Record<string, string> = {
  software: "SOFTWARE",
  hardware: "HARDWARE",
  office:   "BÜRO",
  training: "TRAINING",
  travel:   "REISE",
  hosting:  "HOSTING",
  services: "DIENSTE",
  other:    "SONSTIGE",
};

type Expense = {
  _id: string;
  description: string;
  vendor?: string;
  category: string;
  amountGross: number;
  businessUsePct: number;
  date: string;
  paid: boolean;
};

const EMPTY_FORM = {
  description: "",
  vendor: "",
  category: "software",
  amountGross: "",
  businessUsePct: "100",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load(search: string) {
    setLoading(true);
    fetch(`/api/expenses${search ? `?q=${encodeURIComponent(search)}` : ""}`)
      .then((r) => r.json())
      .then((res) => setExpenses(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(""); }, []);

  function handleSearch(v: string) {
    setQ(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => load(v), 350);
  }

  function set(k: keyof typeof EMPTY_FORM, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.amountGross) {
      setError("Beschreibung und Betrag sind erforderlich.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: form.description,
        vendor: form.vendor || undefined,
        category: form.category,
        amountGross: parseFloat(form.amountGross),
        businessUsePct: parseInt(form.businessUsePct, 10),
        date: form.date,
        paid: true,
        notes: form.notes || undefined,
      }),
    }).then((r) => r.json());
    setSaving(false);
    if (res.success && res.data) {
      setExpenses((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } else {
      setError(res.error ?? "Fehler beim Speichern.");
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pageLabel}>AUSGABEN</div>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>Ausgaben</h1>
          <div className={styles.cardActions}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                placeholder="Suchen..."
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <button className={styles.btnPrimary} onClick={() => { setShowForm(true); setError(null); }}>
              + Ausgabe erfassen
            </button>
          </div>
        </div>

        {/* Inline new-expense form */}
        {showForm && (
          <form className={styles.newForm} onSubmit={handleCreate}>
            <div className={styles.newFormTitle}>Ausgabe erfassen</div>
            {error && <div className={styles.formError}>{error}</div>}
            <div className={styles.formRow2}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>BESCHREIBUNG</label>
                <input className={styles.formInput} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Notion Abo" required />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>ANBIETER</label>
                <input className={styles.formInput} value={form.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="Notion Labs Inc." />
              </div>
            </div>
            <div className={styles.formRow2}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>KATEGORIE</label>
                <select className={styles.formInput} value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {Object.entries(CAT_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>BETRAG (€)</label>
                <input className={styles.formInput} type="number" step="0.01" min="0" value={form.amountGross} onChange={(e) => set("amountGross", e.target.value)} placeholder="16.00" required />
              </div>
              <div className={styles.formRow} style={{ maxWidth: 140 }}>
                <label className={styles.formLabel}>BETRIEBLICH (%)</label>
                <input className={styles.formInput} type="number" min="0" max="100" value={form.businessUsePct} onChange={(e) => set("businessUsePct", e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>DATUM</label>
                <input className={styles.formInput} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnCancel} onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                Abbrechen
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? "Speichern…" : "Ausgabe speichern"}
              </button>
            </div>
          </form>
        )}

        {/* Expense grid */}
        <div className={styles.grid}>
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className={`${styles.expenseCard} ${styles.skeleton}`} style={{ height: 140 }} />)
          ) : expenses.length === 0 ? (
            <div className={styles.empty}>Keine Ausgaben vorhanden.</div>
          ) : (
            expenses.map((exp) => (
              <div
                key={exp._id}
                className={styles.expenseCard}
                style={{ borderLeftColor: CAT_COLOR[exp.category] ?? "#666" }}
              >
                <div className={styles.expCardTop}>
                  <span className={styles.expCategory} style={{ color: CAT_COLOR[exp.category] ?? "#666" }}>
                    {CAT_LABEL[exp.category] ?? exp.category.toUpperCase()}
                  </span>
                  <span className={styles.expAmount}>{fmt(exp.amountGross)}</span>
                </div>
                <div className={styles.expName}>{exp.description}</div>
                {exp.vendor && <div className={styles.expVendor}>{exp.vendor}</div>}
                <div className={styles.expFooter}>
                  <span className={styles.expDate}>
                    {new Date(exp.date).toLocaleDateString("de-DE")}
                  </span>
                  <span className={styles.expBadge}>
                    {exp.businessUsePct}% betrieblich
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
