"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./invoices.module.css";

type ImportResult = { imported: number; total: number; errors: string[] };

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: "Entwurf",   color: "#888",    bg: "#1e1e26" },
  issued:   { label: "Offen",     color: "#f0215d", bg: "#2a1018" },
  paid:     { label: "Bezahlt",   color: "#c8f04a", bg: "#1a2210" },
  canceled: { label: "Storniert", color: "#0dd3b8", bg: "#0e2222" },
};

type Invoice = {
  _id: string;
  invoiceNumber: string;
  status: string;
  clientSnapshot?: { companyName?: string; contactName?: string };
  items?: Array<{ title: string }>;
  issuedAt?: string;
  dueAt?: string;
  total: number;
};

type Filter = "all" | "draft" | "issued" | "paid" | "canceled";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | "all">(new Date().getFullYear());
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef    = useRef<HTMLInputElement | null>(null);
  const pdfInputRef     = useRef<HTMLInputElement | null>(null);

  function load(search: string) {
    setLoading(true);
    fetch(`/api/invoices${search ? `?q=${encodeURIComponent(search)}` : ""}`)
      .then((r) => r.json())
      .then((res) => setInvoices(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(""); }, []);

  function handleSearch(v: string) {
    setQ(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => load(v), 350);
  }

  const currentYear = new Date().getFullYear();
  const availableYears = [
    currentYear,
    ...Array.from(new Set(invoices.map((i) => (i as any).year).filter((y) => y > 0))),
  ].filter((y, idx, arr) => arr.indexOf(y) === idx).sort((a, b) => b - a);

  const byYear = yearFilter === "all"
    ? invoices
    : invoices.filter((i) => (i as any).year === yearFilter || i.status === "draft");

  const counts: Record<Filter, number> = {
    all:      byYear.length,
    draft:    byYear.filter((i) => i.status === "draft").length,
    issued:   byYear.filter((i) => i.status === "issued").length,
    paid:     byYear.filter((i) => i.status === "paid").length,
    canceled: byYear.filter((i) => i.status === "canceled").length,
  };

  const visible = filter === "all" ? byYear : byYear.filter((i) => i.status === filter);

  const TABS: { key: Filter; label: string }[] = [
    { key: "all",      label: "Alle" },
    { key: "draft",    label: "Entwurf" },
    { key: "issued",   label: "Offen" },
    { key: "paid",     label: "Bezahlt" },
    { key: "canceled", label: "Storniert" },
  ];

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/invoices/import", { method: "POST", body: fd }).then((r) => r.json());
    setImporting(false);
    if (res.success) {
      setImportResult({ imported: res.imported, total: res.total, errors: res.errors ?? [] });
      load(q);
    } else {
      setImportResult({ imported: 0, total: 0, errors: [res.error ?? "Fehler beim Import"] });
    }
  }

  async function handlePdfImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    const res = await fetch("/api/invoices/import-pdf", { method: "POST", body: fd }).then((r) => r.json());
    setImporting(false);
    if (res.success) {
      setImportResult({ imported: res.imported, total: res.total, errors: res.errors ?? [] });
      load(q);
    } else {
      setImportResult({ imported: 0, total: 0, errors: [res.error ?? "Fehler beim PDF-Import"] });
    }
  }

  async function markPaid(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setPaying(id);
    const res = await fetch(`/api/invoices/${id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json());
    setPaying(null);
    if (res.success) {
      setInvoices((prev) => prev.map((inv) => inv._id === id ? { ...inv, status: "paid" } : inv));
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pageLabel}>RECHNUNGEN – LISTE</div>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <div className={styles.headerRow1}>
            <h1 className={styles.cardTitle}>Rechnungen</h1>
            <Link href="/invoices/new" className={styles.btnPrimary}>
              + Neue Rechnung
            </Link>
          </div>
          <div className={styles.headerRow2}>
            <div className={styles.secondaryActions}>
              <a href="/api/reports/export?type=eur" className={styles.btnSecondary}>
                ↓ Exportieren
              </a>
              <a href="/templates/rechnungen-vorlage.csv" download className={styles.btnSecondary}>
                ↓ Vorlage CSV
              </a>
              <button
                className={styles.btnSecondary}
                onClick={() => pdfInputRef.current?.click()}
                disabled={importing}
                style={{ cursor: importing ? "not-allowed" : "pointer", fontWeight: 600 }}
              >
                {importing ? "Importieren…" : "↑ PDFs importieren"}
              </button>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                multiple
                style={{ display: "none" }}
                onChange={handlePdfImport}
              />
              <button
                className={styles.btnSecondary}
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                style={{ cursor: importing ? "not-allowed" : "pointer" }}
              >
                {importing ? "Importieren…" : "↑ CSV importieren"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={handleImport}
              />
            </div>
            <div className={styles.headerRow2Right}>
              <select
                className={styles.yearSelect}
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              >
                <option value="all">Alle Jahre</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
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
            </div>
          </div>
        </div>

        {/* Import result banner */}
        {importResult && (
          <div className={importResult.imported === 0 ? styles.importBannerError : styles.importBanner}>
            <div>
              <div>
                {importResult.imported > 0
                  ? `${importResult.imported} von ${importResult.total} Rechnungen importiert.`
                  : "Import fehlgeschlagen."}
                {importResult.errors.length > 0 && ` ${importResult.errors.length} Fehler.`}
              </div>
              {importResult.errors.length > 0 && (
                <div className={styles.importBannerErrors}>
                  {importResult.errors.slice(0, 5).join(" · ")}
                  {importResult.errors.length > 5 && ` · +${importResult.errors.length - 5} weitere`}
                </div>
              )}
            </div>
            <button className={styles.importBannerClose} onClick={() => setImportResult(null)}>✕</button>
          </div>
        )}

        {/* Filter tabs */}
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`${styles.tab} ${filter === t.key ? styles.tabActive : ""}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`${styles.tabCount} ${filter === t.key ? styles.tabCountActive : ""}`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>NR.</th>
              <th>KUNDE</th>
              <th>AUSGESTELLT</th>
              <th>FÄLLIG BIS</th>
              <th style={{ textAlign: "right" }}>BETRAG</th>
              <th>STATUS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className={styles.skeleton} style={{ height: 160, margin: "16px" }} /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={7} className={styles.emptyCell}>Keine Rechnungen gefunden.</td></tr>
            ) : (
              visible.map((inv) => {
                const isDraft = inv.status === "draft";
                const clientName = inv.clientSnapshot?.companyName || inv.clientSnapshot?.contactName || "–";
                const subtitle = isDraft ? "Kein Kunde zugewiesen" : inv.items?.[0]?.title ?? "–";
                const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.draft;
                return (
                  <tr key={inv._id} className={styles.tableRow} onClick={() => { window.location.href = `/invoices/${inv._id}`; }}>
                    <td className={isDraft ? styles.numDraft : styles.numActive}>
                      {isDraft ? "draft" : inv.invoiceNumber}
                    </td>
                    <td>
                      <div className={styles.clientName}>{isDraft ? "–" : clientName}</div>
                      <div className={styles.clientSub}>{subtitle}</div>
                    </td>
                    <td className={styles.dateCell}>
                      {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("de-DE") : "–"}
                    </td>
                    <td className={styles.dateCell}>
                      {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString("de-DE") : "–"}
                    </td>
                    <td style={{ textAlign: "right" }} className={inv.total < 0 ? styles.negative : styles.amount}>
                      {isDraft
                        ? <span className={styles.muted}>{fmt(inv.total)}</span>
                        : fmt(inv.total)}
                    </td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{ color: cfg.color, background: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {inv.status === "issued" && (
                        <button
                          className={styles.btnMarkPaid}
                          disabled={paying === inv._id}
                          onClick={(e) => markPaid(e, inv._id)}
                        >
                          {paying === inv._id ? "…" : "✓ Bezahlt"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
