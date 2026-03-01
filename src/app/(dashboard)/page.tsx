"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./dashboard.module.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const MONTHS = ["JAN","FEB","MÄR","APR","MAI","JUN","JUL","AUG","SEP","OKT","NOV","DEZ"];
const CHART_H = 90;
const CHART_W = 600;
const SLOT_W = CHART_W / 12;

type Totals = {
  incomePaid: number;
  expensesBusinessPaid: number;
  profit: number;
  outstanding: number;
};

type MonthlyEntry = {
  month: number;
  incomePaid: number;
  expensesBusinessPaid: number;
};

type Invoice = {
  _id: string;
  invoiceNumber: string;
  clientSnapshot?: { companyName?: string };
  issuedAt?: string;
  total: number;
  status: string;
  items?: Array<{ title: string }>;
};

export default function DashboardPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [totals, setTotals] = useState<Totals | null>(null);
  const [prevIncomePaid, setPrevIncomePaid] = useState<number | null>(null);
  const [monthly, setMonthly] = useState<MonthlyEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/reports/summary?year=${year}`).then((r) => r.json()),
      fetch(`/api/reports/summary?year=${year - 1}`).then((r) => r.json()),
      fetch(`/api/invoices`).then((r) => r.json()),
      fetch(`/api/invoices?status=issued`).then((r) => r.json()),
    ])
      .then(([curr, prev, allInv, openInv]) => {
        if (!mounted) return;
        const t = curr.totals ?? {};
        setTotals({
          incomePaid: t.incomePaid ?? 0,
          expensesBusinessPaid: t.expensesBusinessPaid ?? 0,
          profit: t.profit ?? 0,
          outstanding: t.outstanding ?? 0,
        });
        setPrevIncomePaid(prev.totals?.incomePaid ?? 0);
        setMonthly(curr.monthly ?? []);
        setInvoices((allInv.data ?? []).slice(0, 5));
        setOpenCount((openInv.data ?? []).length);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [year]);

  const incomePct =
    prevIncomePaid != null && totals
      ? prevIncomePaid === 0
        ? totals.incomePaid > 0 ? 100 : null
        : Math.round(((totals.incomePaid - prevIncomePaid) / prevIncomePaid) * 100)
      : null;

  const maxVal = Math.max(
    ...monthly.map((m) => Math.max(m.incomePaid, m.expensesBusinessPaid)),
    1
  );

  return (
    <div className={styles.wrap}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Geschäftsjahr {year} · Stand heute</p>
        </div>
        <div className={styles.headerActions}>
          <a href={`/api/reports/export?year=${year}&type=eur`} className={styles.btnSecondary}>
            ↓ CSV Export
          </a>
          <Link href="/invoices/new" className={styles.btnPrimary}>
            + Neue Rechnung
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className={styles.kpis}>
        <div className={`${styles.kpi} ${styles.kpiIncome}`}>
          <div className={styles.kpiLabel}>EINNAHMEN (BEZAHLT)</div>
          <div className={`${styles.kpiValue} ${styles.colorIncome}`}>
            {loading
              ? <span className={styles.skeletonInline} style={{ width: 130 }} />
              : fmt(totals?.incomePaid ?? 0)}
          </div>
          <div className={styles.kpiSub}>
            {year} ·{" "}
            {incomePct !== null ? (
              <span className={incomePct >= 0 ? styles.colorIncome : styles.colorExpense}>
                {incomePct >= 0 ? "+" : ""}{incomePct}% vs. Vorjahr
              </span>
            ) : "–"}
          </div>
        </div>

        <div className={`${styles.kpi} ${styles.kpiExpense}`}>
          <div className={styles.kpiLabel}>AUSGABEN</div>
          <div className={`${styles.kpiValue} ${styles.colorExpense}`}>
            {loading
              ? <span className={styles.skeletonInline} style={{ width: 90 }} />
              : fmt(totals?.expensesBusinessPaid ?? 0)}
          </div>
          <div className={styles.kpiSub}>{year} · Betriebsanteil</div>
        </div>

        <div className={`${styles.kpi} ${styles.kpiProfit}`}>
          <div className={styles.kpiLabel}>GEWINN (EÜR)</div>
          <div className={`${styles.kpiValue} ${styles.colorProfit}`}>
            {loading
              ? <span className={styles.skeletonInline} style={{ width: 120 }} />
              : fmt(totals?.profit ?? 0)}
          </div>
          <div className={styles.kpiSub}>Einnahmen – Ausgaben</div>
        </div>

        <div className={`${styles.kpi} ${styles.kpiOpen}`}>
          <div className={styles.kpiLabel}>OFFEN / AUSSTEHEND</div>
          <div className={styles.kpiValue}>
            {loading
              ? <span className={styles.skeletonInline} style={{ width: 90 }} />
              : fmt(totals?.outstanding ?? 0)}
          </div>
          <div className={styles.kpiSub}>{openCount} Rechnungen offen</div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className={styles.quick}>
        <Link href="/invoices/new" className={styles.quickCard}>
          <div className={styles.quickIcon} style={{ background: "#1c1c26" }}>📄</div>
          <div>
            <div className={styles.quickTitle}>Rechnung erstellen</div>
            <div className={styles.quickSub}>Draft anlegen &amp; ausstellen</div>
          </div>
        </Link>
        <Link href="/expenses/new" className={styles.quickCard}>
          <div className={styles.quickIcon} style={{ background: "#162016" }}>✏️</div>
          <div>
            <div className={styles.quickTitle}>Ausgabe erfassen</div>
            <div className={styles.quickSub}>Software, Hardware, Büro…</div>
          </div>
        </Link>
        <a href={`/api/reports/export?year=${year}&type=eur`} className={styles.quickCard}>
          <div className={styles.quickIcon} style={{ background: "#161622" }}>📊</div>
          <div>
            <div className={styles.quickTitle}>EÜR exportieren</div>
            <div className={styles.quickSub}>CSV für das Finanzamt</div>
          </div>
        </a>
      </div>

      {/* ── Bottom columns ── */}
      <div className={styles.columns}>
        {/* Letzte Rechnungen */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <span className={styles.sectionTitle}>Letzte Rechnungen</span>
            <Link href="/invoices" className={styles.tableLink}>Alle anzeigen →</Link>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>NR.</th>
                <th>KUNDE</th>
                <th>DATUM</th>
                <th style={{ textAlign: "right" }}>BETRAG</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>
                    <div className={styles.skeleton} style={{ height: 140, margin: "12px 18px" }} />
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.emptyCell}>Keine Rechnungen vorhanden</td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isDraft = inv.status === "draft";
                  const isStorno = inv.status === "storno";
                  const date = inv.issuedAt
                    ? new Date(inv.issuedAt).toLocaleDateString("de-DE")
                    : "–";
                  const subtitle = isStorno
                    ? "Stornorechnung"
                    : inv.items?.[0]?.title ?? "–";
                  return (
                    <tr
                      key={inv._id}
                      onClick={() => { window.location.href = `/invoices/${inv._id}`; }}
                      className={styles.tableRow}
                    >
                      <td className={isDraft ? styles.numDraft : styles.numActive}>
                        {isDraft ? "draft" : inv.invoiceNumber}
                      </td>
                      <td>
                        <div className={styles.clientName}>
                          {inv.clientSnapshot?.companyName ?? "–"}
                        </div>
                        <div className={styles.invoiceSub}>{subtitle}</div>
                      </td>
                      <td className={styles.dateCell}>{date}</td>
                      <td
                        style={{ textAlign: "right" }}
                        className={
                          isStorno
                            ? styles.colorExpense
                            : isDraft
                            ? styles.colorMuted
                            : styles.amountCell
                        }
                      >
                        {isDraft ? "–" : fmt(isStorno ? -Math.abs(inv.total) : inv.total)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* EÜR Zusammenfassung */}
        <div className={styles.eurCard}>
          <div className={styles.eurHeader}>
            <span className={styles.sectionTitle}>EÜR Zusammenfassung</span>
            <div className={styles.yearNav}>
              <button onClick={() => setYear((y) => y - 1)}>‹</button>
              <span>{year}</span>
              <button onClick={() => setYear((y) => y + 1)}>›</button>
            </div>
          </div>

          {loading ? (
            <div className={styles.skeleton} style={{ height: 112 }} />
          ) : (
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H + 22}`}
              width="100%"
              style={{ display: "block" }}
            >
              {monthly.map((m, i) => {
                const cx = i * SLOT_W + SLOT_W / 2;
                const bw = Math.floor(SLOT_W * 0.28);
                const ih = (m.incomePaid / maxVal) * CHART_H;
                const eh = (m.expensesBusinessPaid / maxVal) * CHART_H;
                return (
                  <g key={m.month}>
                    <rect
                      x={cx - bw - 1}
                      y={CHART_H - ih}
                      width={bw}
                      height={Math.max(ih, 1.5)}
                      fill="#c8f04a"
                      rx={2}
                    />
                    <rect
                      x={cx + 1}
                      y={CHART_H - eh}
                      width={bw}
                      height={Math.max(eh, 1.5)}
                      fill="#f0215d"
                      rx={2}
                    />
                    <text
                      x={cx}
                      y={CHART_H + 15}
                      textAnchor="middle"
                      fill="#555"
                      fontSize={9}
                      fontFamily="DM Mono, monospace"
                    >
                      {MONTHS[i]}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          <div className={styles.eurLegend}>
            <span>
              <span className={styles.dot} style={{ background: "#c8f04a" }} />
              Einnahmen
            </span>
            <span>
              <span className={styles.dot} style={{ background: "#f0215d" }} />
              Ausgaben
            </span>
          </div>

          <div className={styles.eurLine}>
            <span>Einnahmen (bezahlt)</span>
            <span className={styles.colorIncome}>
              {loading ? "–" : fmt(totals?.incomePaid ?? 0)}
            </span>
          </div>
          <div className={styles.eurLine}>
            <span>Ausgaben</span>
            <span className={styles.colorExpense}>
              {loading ? "–" : fmt(totals?.expensesBusinessPaid ?? 0)}
            </span>
          </div>
          <div className={`${styles.eurLine} ${styles.eurLineTotal}`}>
            <span>Gewinn</span>
            <span className={styles.colorProfit}>
              {loading ? "–" : fmt(totals?.profit ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
