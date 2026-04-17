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
  notes?: string;
  receiptFileId?: string;
  receiptFilename?: string;
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

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2023 }, (_, i) => String(CURRENT_YEAR - i));

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [q, setQ] = useState("");
  const [yearFilter, setYearFilter] = useState(String(CURRENT_YEAR));
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load(search: string, year: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (year) params.set("year", year);
    fetch(`/api/expenses?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => setExpenses(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load("", yearFilter); }, []);

  function handleSearch(v: string) {
    setQ(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => load(v, yearFilter), 350);
  }

  function handleYearChange(y: string) {
    setYearFilter(y);
    load(q, y);
  }

  function set(k: keyof typeof EMPTY_FORM, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setE(k: keyof typeof EMPTY_FORM, v: string) {
    setEditForm((f) => ({ ...f, [k]: v }));
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

  function openEdit(exp: Expense) {
    setEditingId(exp._id);
    setEditForm({
      description: exp.description,
      vendor: exp.vendor ?? "",
      category: exp.category,
      amountGross: String(exp.amountGross),
      businessUsePct: String(exp.businessUsePct),
      date: exp.date.slice(0, 10),
      notes: exp.notes ?? "",
    });
    setShowForm(false);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    const res = await fetch(`/api/expenses/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editForm.description,
        vendor: editForm.vendor || undefined,
        category: editForm.category,
        amountGross: parseFloat(editForm.amountGross),
        businessUsePct: parseInt(editForm.businessUsePct, 10),
        date: editForm.date,
        paid: true,
        notes: editForm.notes || undefined,
      }),
    }).then((r) => r.json());
    setEditSaving(false);
    if (res.success && res.data) {
      setExpenses((prev) => prev.map((x) => (x._id === editingId ? res.data : x)));
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Ausgabe löschen?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" }).then((r) => r.json());
    setDeletingId(null);
    if (res.success) {
      setExpenses((prev) => prev.filter((x) => x._id !== id));
      if (editingId === id) setEditingId(null);
    }
  }

  function triggerUpload(expenseId: string) {
    uploadTargetId.current = expenseId;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const targetId = uploadTargetId.current;
    if (!file || !targetId) return;
    e.target.value = "";

    setUploadingId(targetId);
    const fd = new FormData();
    fd.append("receipt", file);
    const res = await fetch(`/api/expenses/${targetId}/receipt`, {
      method: "POST",
      body: fd,
    }).then((r) => r.json());
    setUploadingId(null);
    if (res.success && res.data) {
      setExpenses((prev) => prev.map((x) => (x._id === targetId ? res.data : x)));
    } else {
      alert(res.error ?? "Upload fehlgeschlagen.");
    }
  }

  async function deleteReceipt(expenseId: string) {
    if (!confirm("Beleg löschen?")) return;
    setDeletingReceiptId(expenseId);
    const res = await fetch(`/api/expenses/${expenseId}/receipt`, { method: "DELETE" }).then((r) => r.json());
    setDeletingReceiptId(null);
    if (res.success && res.data) {
      setExpenses((prev) => prev.map((x) => (x._id === expenseId ? res.data : x)));
    }
  }

  function exportCSV() {
    const rows = [
      ["Datum", "Beschreibung", "Anbieter", "Kategorie", "Betrag (€)", "Betrieblich (%)", "Abzugsfähig (€)"],
      ...expenses.map((exp) => [
        new Date(exp.date).toLocaleDateString("de-DE"),
        exp.description,
        exp.vendor ?? "",
        CAT_LABEL[exp.category] ?? exp.category,
        exp.amountGross.toFixed(2).replace(".", ","),
        String(exp.businessUsePct),
        ((exp.amountGross * exp.businessUsePct) / 100).toFixed(2).replace(".", ","),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ausgaben-${yearFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalGross = expenses.reduce((s, e) => s + e.amountGross, 0);
  const totalDeductible = expenses.reduce((s, e) => s + (e.amountGross * e.businessUsePct) / 100, 0);
  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + (e.amountGross * e.businessUsePct) / 100;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className={styles.wrap}>
      {/* Hidden file input for receipt uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />
      <div className={styles.pageLabel}>AUSGABEN</div>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>Ausgaben</h1>
          <div className={styles.cardActions}>
            <select
              className={styles.yearSelect}
              value={yearFilter}
              onChange={(e) => handleYearChange(e.target.value)}
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                placeholder="Suchen..."
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <button className={styles.btnSecondary} onClick={exportCSV} title="Als CSV exportieren">
              ↓ CSV
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => { setShowForm(true); setEditingId(null); setError(null); }}
            >
              + Ausgabe erfassen
            </button>
          </div>
        </div>

        {/* Create form */}
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
                  {Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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

        {/* Edit form */}
        {editingId && (
          <form className={styles.editForm} onSubmit={handleEdit}>
            <div className={styles.newFormTitle} style={{ color: "#a78bf5" }}>Ausgabe bearbeiten</div>
            <div className={styles.formRow2}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>BESCHREIBUNG</label>
                <input className={styles.formInput} value={editForm.description} onChange={(e) => setE("description", e.target.value)} required />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>ANBIETER</label>
                <input className={styles.formInput} value={editForm.vendor} onChange={(e) => setE("vendor", e.target.value)} />
              </div>
            </div>
            <div className={styles.formRow2}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>KATEGORIE</label>
                <select className={styles.formInput} value={editForm.category} onChange={(e) => setE("category", e.target.value)}>
                  {Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>BETRAG (€)</label>
                <input className={styles.formInput} type="number" step="0.01" min="0" value={editForm.amountGross} onChange={(e) => setE("amountGross", e.target.value)} required />
              </div>
              <div className={styles.formRow} style={{ maxWidth: 140 }}>
                <label className={styles.formLabel}>BETRIEBLICH (%)</label>
                <input className={styles.formInput} type="number" min="0" max="100" value={editForm.businessUsePct} onChange={(e) => setE("businessUsePct", e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>DATUM</label>
                <input className={styles.formInput} type="date" value={editForm.date} onChange={(e) => setE("date", e.target.value)} />
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnCancel} onClick={() => setEditingId(null)}>Abbrechen</button>
              <button type="submit" className={styles.btnPrimary} disabled={editSaving}>
                {editSaving ? "Speichern…" : "Änderungen speichern"}
              </button>
            </div>
          </form>
        )}

        {/* Expense grid */}
        <div className={styles.grid}>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className={`${styles.expenseCard} ${styles.skeleton}`} style={{ height: 140 }} />
            ))
          ) : expenses.length === 0 ? (
            <div className={styles.empty}>Keine Ausgaben für {yearFilter} vorhanden.</div>
          ) : (
            expenses.map((exp) => (
              <div
                key={exp._id}
                className={`${styles.expenseCard} ${editingId === exp._id ? styles.expenseCardActive : ""}`}
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
                  <span className={styles.expBadge}>{exp.businessUsePct}% betrieblich</span>
                </div>
                {/* Receipt row */}
                <div className={styles.receiptRow}>
                  {exp.receiptFileId ? (
                    <>
                      <a
                        className={styles.receiptLink}
                        href={`/api/expenses/${exp._id}/receipt`}
                        target="_blank"
                        rel="noreferrer"
                        title={exp.receiptFilename}
                      >
                        📎 {exp.receiptFilename ?? "Beleg"}
                      </a>
                      <button
                        className={styles.btnReceiptDelete}
                        onClick={() => deleteReceipt(exp._id)}
                        disabled={deletingReceiptId === exp._id}
                        title="Beleg löschen"
                      >
                        {deletingReceiptId === exp._id ? "…" : "✕"}
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.btnReceiptUpload}
                      onClick={() => triggerUpload(exp._id)}
                      disabled={uploadingId === exp._id}
                    >
                      {uploadingId === exp._id ? "Hochladen…" : "📎 Beleg hochladen"}
                    </button>
                  )}
                </div>
                <div className={styles.expCardActions}>
                  <button className={styles.btnCardEdit} onClick={() => openEdit(exp)}>✎ Bearbeiten</button>
                  <button
                    className={styles.btnCardDelete}
                    onClick={() => handleDelete(exp._id)}
                    disabled={deletingId === exp._id}
                  >
                    {deletingId === exp._id ? "…" : "✕"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {!loading && expenses.length > 0 && (
          <div className={styles.summary}>
            <div className={styles.summaryTitle}>ZUSAMMENFASSUNG {yearFilter}</div>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryBlock}>
                <div className={styles.summaryLabel}>GESAMT BRUTTO</div>
                <div className={styles.summaryValue}>{fmt(totalGross)}</div>
              </div>
              <div className={styles.summaryBlock}>
                <div className={styles.summaryLabel}>ABZUGSFÄHIG</div>
                <div className={styles.summaryValueGreen}>{fmt(totalDeductible)}</div>
              </div>
              <div className={styles.summaryBlock} style={{ flex: 2 }}>
                <div className={styles.summaryLabel}>NACH KATEGORIE (abzugsfähig)</div>
                <div className={styles.summaryCategories}>
                  {byCategory.map(([cat, amt]) => (
                    <div key={cat} className={styles.summaryCatItem}>
                      <span style={{ color: CAT_COLOR[cat] ?? "#666" }}>
                        {CAT_LABEL[cat] ?? cat.toUpperCase()}
                      </span>
                      <span>{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
