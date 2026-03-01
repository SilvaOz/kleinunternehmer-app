"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./invoices.module.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: "draft",    color: "#888",    bg: "#1e1e26" },
  issued:   { label: "issued",   color: "#f0215d", bg: "#2a1018" },
  paid:     { label: "paid",     color: "#c8f04a", bg: "#1a2210" },
  canceled: { label: "canceled", color: "#0dd3b8", bg: "#0e2222" },
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
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const counts: Record<Filter, number> = {
    all:      invoices.length,
    draft:    invoices.filter((i) => i.status === "draft").length,
    issued:   invoices.filter((i) => i.status === "issued").length,
    paid:     invoices.filter((i) => i.status === "paid").length,
    canceled: invoices.filter((i) => i.status === "canceled").length,
  };

  const visible = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  const TABS: { key: Filter; label: string }[] = [
    { key: "all",      label: "Alle" },
    { key: "draft",    label: "Draft" },
    { key: "issued",   label: "Issued" },
    { key: "paid",     label: "Paid" },
    { key: "canceled", label: "Canceled" },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.pageLabel}>RECHNUNGEN – LISTE</div>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>Rechnungen</h1>
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
            <a href="/api/reports/export?type=eur" className={styles.btnSecondary}>
              ↓ Export
            </a>
            <Link href="/invoices/new" className={styles.btnPrimary}>
              + Neue Rechnung
            </Link>
          </div>
        </div>

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
        <table className={styles.table}>
          <thead>
            <tr>
              <th>NR.</th>
              <th>KUNDE</th>
              <th>AUSGESTELLT</th>
              <th>FÄLLIG BIS</th>
              <th style={{ textAlign: "right" }}>BETRAG</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className={styles.skeleton} style={{ height: 160, margin: "16px" }} /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={6} className={styles.emptyCell}>Keine Rechnungen gefunden.</td></tr>
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
