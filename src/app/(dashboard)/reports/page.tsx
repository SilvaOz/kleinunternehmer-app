"use client";
import { useState, useEffect } from "react";
import styles from "./reports.module.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTHS_SHORT = ["JAN","FEB","MÄR","APR","MAI","JUN","JUL","AUG","SEP","OKT","NOV","DEZ"];

const CHART_H = 100;
const CHART_W = 600;
const SLOT_W = CHART_W / 12;

type Totals = { incomePaid: number; expensesBusinessPaid: number; profit: number; outstanding: number };
type MonthlyEntry = { month: number; incomePaid: number; expensesBusinessPaid: number; profit: number };

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [totals, setTotals] = useState<Totals | null>(null);
  const [monthly, setMonthly] = useState<MonthlyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/reports/summary?year=${year}`)
      .then((r) => r.json())
      .then((res) => {
        if (!mounted) return;
        setTotals(res.totals ?? null);
        setMonthly(res.monthly ?? []);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [year]);

  const maxVal = Math.max(
    ...monthly.map((m) => Math.max(m.incomePaid, m.expensesBusinessPaid)),
    1
  );

  const totalRows = [
    { label: "Einnahmen (bezahlt)", value: totals?.incomePaid ?? 0, color: "#c8f04a" },
    { label: "Ausgaben (betrieblich)", value: totals?.expensesBusinessPaid ?? 0, color: "#f0215d" },
    { label: "Gewinn (EÜR)", value: totals?.profit ?? 0, color: "#0dd3b8" },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.pageLabel}>EÜR / REPORTS</div>

      {/* ── Main card ── */}
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>EÜR {year}</h1>
          <div className={styles.cardActions}>
            <div className={styles.yearNav}>
              <button onClick={() => setYear((y) => y - 1)}>‹</button>
              <span>{year}</span>
              <button onClick={() => setYear((y) => y + 1)}>›</button>
            </div>
            <a
              href={`/api/reports/export?year=${year}&type=eur`}
              className={styles.btnSecondary}
            >
              ↓ CSV Export
            </a>
          </div>
        </div>

        {/* KPI row */}
        <div className={styles.kpis}>
          <div className={`${styles.kpi} ${styles.kpiIncome}`}>
            <div className={styles.kpiLabel}>EINNAHMEN (BEZAHLT)</div>
            <div className={`${styles.kpiValue} ${styles.colorIncome}`}>
              {loading ? <span className={styles.skeletonInline} /> : fmt(totals?.incomePaid ?? 0)}
            </div>
          </div>
          <div className={`${styles.kpi} ${styles.kpiExpense}`}>
            <div className={styles.kpiLabel}>AUSGABEN (BETRIEBLICH)</div>
            <div className={`${styles.kpiValue} ${styles.colorExpense}`}>
              {loading ? <span className={styles.skeletonInline} /> : fmt(totals?.expensesBusinessPaid ?? 0)}
            </div>
          </div>
          <div className={`${styles.kpi} ${styles.kpiProfit}`}>
            <div className={styles.kpiLabel}>GEWINN (EÜR)</div>
            <div className={`${styles.kpiValue} ${styles.colorProfit}`}>
              {loading ? <span className={styles.skeletonInline} /> : fmt(totals?.profit ?? 0)}
            </div>
          </div>
          <div className={`${styles.kpi} ${styles.kpiOpen}`}>
            <div className={styles.kpiLabel}>OFFEN / AUSSTEHEND</div>
            <div className={styles.kpiValue}>
              {loading ? <span className={styles.skeletonInline} /> : fmt(totals?.outstanding ?? 0)}
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className={styles.chartWrap}>
          {loading ? (
            <div className={styles.skeleton} style={{ height: 130 }} />
          ) : (
            <>
              <div className={styles.chartLegend}>
                <span><span className={styles.dot} style={{ background: "#c8f04a" }} />Einnahmen</span>
                <span><span className={styles.dot} style={{ background: "#f0215d" }} />Ausgaben</span>
              </div>
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H + 20}`} width="100%" style={{ display: "block" }}>
                {monthly.map((m, i) => {
                  const cx = i * SLOT_W + SLOT_W / 2;
                  const bw = Math.floor(SLOT_W * 0.3);
                  const ih = (m.incomePaid / maxVal) * CHART_H;
                  const eh = (m.expensesBusinessPaid / maxVal) * CHART_H;
                  return (
                    <g key={m.month}>
                      <rect x={cx - bw - 1} y={CHART_H - ih} width={bw} height={Math.max(ih, 1.5)} fill="#c8f04a" rx={2} />
                      <rect x={cx + 1} y={CHART_H - eh} width={bw} height={Math.max(eh, 1.5)} fill="#f0215d" rx={2} />
                      <text x={cx} y={CHART_H + 14} textAnchor="middle" fill="#555" fontSize={9} fontFamily="DM Mono, monospace">
                        {MONTHS_SHORT[i]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </>
          )}
        </div>

        {/* Monthly table */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>MONAT</th>
              <th style={{ textAlign: "right" }}>EINNAHMEN</th>
              <th style={{ textAlign: "right" }}>AUSGABEN</th>
              <th style={{ textAlign: "right" }}>GEWINN</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}><div className={styles.skeleton} style={{ height: 240, margin: "12px 0" }} /></td></tr>
            ) : (
              monthly.map((m, i) => {
                const hasData = m.incomePaid > 0 || m.expensesBusinessPaid > 0;
                return (
                  <tr key={m.month} className={hasData ? styles.activeRow : styles.emptyRow}>
                    <td>{MONTHS[i]}</td>
                    <td style={{ textAlign: "right" }} className={m.incomePaid > 0 ? styles.colorIncome : styles.muted}>
                      {m.incomePaid > 0 ? fmt(m.incomePaid) : "–"}
                    </td>
                    <td style={{ textAlign: "right" }} className={m.expensesBusinessPaid > 0 ? styles.colorExpense : styles.muted}>
                      {m.expensesBusinessPaid > 0 ? fmt(m.expensesBusinessPaid) : "–"}
                    </td>
                    <td style={{ textAlign: "right" }} className={m.profit !== 0 ? styles.colorProfit : styles.muted}>
                      {m.profit !== 0 ? fmt(m.profit) : "–"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {!loading && totals && (
            <tfoot>
              <tr className={styles.totalRow}>
                <td>GESAMT {year}</td>
                <td style={{ textAlign: "right" }} className={styles.colorIncome}>{fmt(totals.incomePaid)}</td>
                <td style={{ textAlign: "right" }} className={styles.colorExpense}>{fmt(totals.expensesBusinessPaid)}</td>
                <td style={{ textAlign: "right" }} className={styles.colorProfit}>{fmt(totals.profit)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Export section */}
        <div className={styles.exportSection}>
          <div className={styles.exportText}>
            <div className={styles.exportTitle}>Finanzamt-Export</div>
            <div className={styles.exportSub}>
              CSV-Datei für die EÜR-Anlage {year} · §19 UStG
            </div>
          </div>
          <a href={`/api/reports/export?year=${year}&type=eur`} className={styles.btnExport}>
            ↓ EÜR als CSV exportieren
          </a>
        </div>
      </div>
    </div>
  );
}
