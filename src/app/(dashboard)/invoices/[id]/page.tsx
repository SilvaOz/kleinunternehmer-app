"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./detail.module.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

function fmtDate(d?: string) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE");
}
function fmtDateTime(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.toLocaleDateString("de-DE")} · ${dt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: "Entwurf",   color: "#888",    bg: "#1e1e26" },
  issued:   { label: "Offen",     color: "#f0952d", bg: "#2a1e10" },
  paid:     { label: "Bezahlt",   color: "#c8f04a", bg: "#1a2210" },
  canceled: { label: "Storniert", color: "#0dd3b8", bg: "#0e2222" },
};

type InvoiceItem = { title: string; qty: number; unitPrice: number; lines?: string[] };
type SnapForm = {
  companyName: string;
  contactName: string;
  street: string;
  zip: string;
  city: string;
  country: string;
};
type Invoice = {
  _id: string;
  invoiceNumber: string;
  status: string;
  clientId?: string;
  issuedAt?: string;
  dueAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  clientSnapshot?: {
    companyName?: string;
    contactName?: string;
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  total: number;
  currency: string;
  kleinunternehmerText?: string;
  footerText?: string;
  stornoOf?: string;
  stornoId?: string;
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingSnap, setEditingSnap] = useState(false);
  const [snapForm, setSnapForm] = useState<SnapForm>({ companyName: "", contactName: "", street: "", zip: "", city: "", country: "Deutschland" });
  const [snapSaving, setSnapSaving] = useState(false);
  const [editingNumber, setEditingNumber] = useState(false);
  const [numberInput, setNumberInput] = useState("");
  const [numberSaving, setNumberSaving] = useState(false);
  const [clientName, setClientName] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState(false);
  const [itemsForm, setItemsForm] = useState<InvoiceItem[]>([]);
  const [issuedAtInput, setIssuedAtInput] = useState("");
  const [dueAtInput, setDueAtInput] = useState("");
  const [itemsSaving, setItemsSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) setInvoice(res.data);
        else setError("Rechnung nicht gefunden.");
      })
      .catch(() => setError("Fehler beim Laden."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!invoice) return;
    if (invoice.clientSnapshot) return; // snapshot has priority
    if (!invoice.clientId) return;
    fetch(`/api/clients/${invoice.clientId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          const c = res.data;
          setClientName(c.companyName || c.contactName || null);
        }
      })
      .catch(() => {});
  }, [invoice]);

  async function doAction(action: string) {
    setActionLoading(action);
    setError(null);
    const res = await fetch(`/api/invoices/${id}/${action}`, { method: "POST" }).then((r) => r.json());
    setActionLoading(null);
    if (res.success && res.data) {
      setInvoice(res.data);
    } else {
      setError(res.error ?? "Aktion fehlgeschlagen.");
    }
  }

  function openSnapEdit() {
    const s = invoice?.clientSnapshot;
    setSnapForm({
      companyName: s?.companyName ?? "",
      contactName: s?.contactName ?? "",
      street: s?.street ?? "",
      zip: s?.zip ?? "",
      city: s?.city ?? "",
      country: s?.country ?? "Deutschland",
    });
    setEditingSnap(true);
  }

  async function saveSnap(e: React.FormEvent) {
    e.preventDefault();
    setSnapSaving(true);
    setError(null);
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientSnapshot: snapForm }),
    }).then((r) => r.json());
    setSnapSaving(false);
    if (res.success && res.data) {
      setInvoice(res.data);
      setEditingSnap(false);
    } else {
      setError(res.error ?? "Fehler beim Speichern.");
    }
  }

  async function saveInvoiceNumber(e: React.FormEvent) {
    e.preventDefault();
    const num = numberInput.trim();
    if (!num) return;
    setNumberSaving(true);
    setError(null);
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceNumber: num }),
    }).then((r) => r.json());
    setNumberSaving(false);
    if (res.success && res.data) {
      setInvoice(res.data);
      setEditingNumber(false);
    } else {
      setError(res.error ?? "Fehler beim Speichern.");
    }
  }

  async function handleDeleteDraft() {
    if (!confirm("Entwurf löschen?")) return;
    setActionLoading("delete");
    setError(null);
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" }).then((r) => r.json());
    setActionLoading(null);
    if (res.success) {
      router.push("/invoices");
    } else {
      setError(res.error ?? "Fehler beim Löschen.");
    }
  }

  async function handleStorno() {
    if (!confirm("Stornorechnung erstellen?")) return;
    setActionLoading("storno");
    setError(null);
    const res = await fetch(`/api/invoices/${id}/storno`, { method: "POST" }).then((r) => r.json());
    setActionLoading(null);
    if (res.success && res.data) {
      router.push(`/invoices/${res.data._id}`);
    } else {
      setError(res.error ?? "Fehler beim Stornieren.");
    }
  }

  async function handleHardDelete() {
    const num = invoice?.invoiceNumber ?? id;
    if (!confirm(`Rechnung ${num} permanent löschen?\n\nDiese Aktion kann NICHT rückgängig gemacht werden.\nDie Rechnung wird vollständig aus der Datenbank entfernt.`)) return;
    setActionLoading("hard-delete");
    setError(null);
    const res = await fetch(`/api/invoices/${id}/hard-delete`, { method: "DELETE" }).then((r) => r.json());
    setActionLoading(null);
    if (res.success) {
      router.push("/invoices");
    } else {
      setError(res.error ?? "Fehler beim Löschen.");
    }
  }

  function openItemsEdit() {
    if (!invoice) return;
    setItemsForm(invoice.items.map((it) => ({ ...it, lines: it.lines ?? [] })));
    const toInputDate = (d?: string) => d ? new Date(d).toISOString().slice(0, 10) : "";
    setIssuedAtInput(toInputDate(invoice.issuedAt));
    setDueAtInput(toInputDate(invoice.dueAt));
    setEditingItems(true);
  }

  function updateItem(idx: number, field: keyof InvoiceItem, value: string | number) {
    setItemsForm((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function removeItem(idx: number) {
    setItemsForm((prev) => prev.filter((_, i) => i !== idx));
  }

  function addItem() {
    setItemsForm((prev) => [...prev, { title: "", qty: 1, unitPrice: 0, lines: [] }]);
  }

  async function saveItems(e: React.FormEvent) {
    e.preventDefault();
    setItemsSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      items: itemsForm.map((it) => ({
        title: it.title,
        qty: Number(it.qty),
        unitPrice: Number(it.unitPrice),
        lines: it.lines ?? [],
      })),
    };
    if (issuedAtInput) body.issuedAt = issuedAtInput;
    if (dueAtInput) body.dueAt = dueAtInput;
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
    setItemsSaving(false);
    if (res.success && res.data) {
      setInvoice(res.data);
      setEditingItems(false);
    } else {
      setError(res.error ?? "Fehler beim Speichern.");
    }
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.pageLabel}>RECHNUNG – DETAILANSICHT</div>
        <div className={styles.layout}>
          <div className={styles.mainCard}>
            <div className={styles.skeleton} style={{ height: 400 }} />
          </div>
          <div className={styles.sideCol}>
            <div className={styles.skeleton} style={{ height: 180 }} />
            <div className={styles.skeleton} style={{ height: 200, marginTop: 12 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className={styles.wrap}>
        <div className={styles.pageLabel}>RECHNUNG – DETAILANSICHT</div>
        <div className={styles.errorBox}>{error}</div>
      </div>
    );
  }

  if (!invoice) return null;

  const cfg = STATUS_CFG[invoice.status] ?? STATUS_CFG.draft;
  const snap = invoice.clientSnapshot;
  const addrLine = snap
    ? [snap.street, `${snap.zip} ${snap.city}`, snap.country].filter(Boolean).join(" · ")
    : "";

  const timeline: { label: string; date: string; type: "done" | "active" | "pending" }[] = [
    { label: "Entwurf erstellt", date: fmtDateTime(invoice.createdAt), type: "done" },
  ];
  if (invoice.issuedAt) {
    timeline.push({ label: "Ausgestellt & gesperrt", date: fmtDateTime(invoice.issuedAt), type: "done" });
  }
  if (invoice.paidAt) {
    timeline.push({ label: "Bezahlt", date: fmtDateTime(invoice.paidAt), type: "active" });
  }
  if (invoice.status === "canceled") {
    timeline.push({ label: "Storniert", date: fmtDateTime(invoice.updatedAt), type: "active" });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pageLabel}>RECHNUNG – DETAILANSICHT</div>
      <div className={styles.layout}>
        {/* ── Main card ── */}
        <div className={styles.mainCard}>
          {/* Invoice header */}
          <div className={styles.invHeader}>
            <div>
              <div className={styles.invLabel}>Rechnung</div>
              {editingNumber ? (
                <form onSubmit={saveInvoiceNumber} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <input
                    autoFocus
                    className={styles.snapInput}
                    style={{ fontSize: 20, fontWeight: 700, width: 160, padding: "4px 8px" }}
                    value={numberInput}
                    onChange={(e) => setNumberInput(e.target.value)}
                  />
                  <button type="submit" className={styles.btnSave} disabled={numberSaving} style={{ padding: "4px 12px" }}>
                    {numberSaving ? "…" : "OK"}
                  </button>
                  <button type="button" className={styles.btnCancel} onClick={() => setEditingNumber(false)} style={{ padding: "4px 10px" }}>
                    ✕
                  </button>
                </form>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className={styles.invNumber}>{invoice.invoiceNumber}</div>
                  <button
                    className={styles.btnEditSnap}
                    onClick={() => { setNumberInput(invoice.invoiceNumber); setEditingNumber(true); }}
                    title="Rechnungsnummer bearbeiten"
                  >
                    ✎
                  </button>
                </div>
              )}
            </div>
            <div className={styles.invHeaderRight}>
              <span className={styles.statusBadge} style={{ color: cfg.color, background: cfg.bg }}>
                ● {cfg.label}
              </span>
              <a
                href={`/api/invoices/${id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className={styles.btnIcon}
              >
                📄 PDF
              </a>
              {(invoice.status === "issued" || invoice.status === "paid") && !invoice.stornoId && (
                <button
                  className={styles.btnStorno}
                  onClick={handleStorno}
                  disabled={actionLoading === "storno"}
                >
                  ↩ Storno
                </button>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className={styles.datesRow}>
            <div className={styles.dateField}>
              <div className={styles.dateLabel}>RECHNUNGSDATUM</div>
              <div className={styles.dateValue}>{fmtDate(invoice.issuedAt)}</div>
            </div>
            <div className={styles.dateField}>
              <div className={styles.dateLabel}>FÄLLIG BIS</div>
              <div className={styles.dateValue}>{fmtDate(invoice.dueAt)}</div>
            </div>
            {invoice.paidAt && (
              <div className={styles.dateField}>
                <div className={styles.dateLabel}>BEZAHLT AM</div>
                <div className={styles.dateValue} style={{ color: "#0dd3b8" }}>{fmtDate(invoice.paidAt)}</div>
              </div>
            )}
          </div>

          {/* Client snapshot (issued/paid) */}
          {snap && !editingSnap && (
            <div className={styles.recipientBox}>
              <div className={styles.recipientLabelRow}>
                <div className={styles.recipientLabel}>EMPFÄNGER</div>
                <button className={styles.btnEditSnap} onClick={openSnapEdit}>Bearbeiten</button>
              </div>
              <div className={styles.recipientName}>{snap.companyName || snap.contactName}</div>
              {addrLine && <div className={styles.recipientAddr}>{addrLine}</div>}
            </div>
          )}
          {/* Client name from reference (draft only) */}
          {!snap && clientName && !editingSnap && (
            <div className={styles.recipientBox}>
              <div className={styles.recipientLabelRow}>
                <div className={styles.recipientLabel}>KUNDE</div>
              </div>
              <div className={styles.recipientName}>{clientName}</div>
            </div>
          )}
          {editingSnap && (
            <form className={styles.snapForm} onSubmit={saveSnap}>
              <div className={styles.snapFormTitle}>Empfänger bearbeiten</div>
              <div className={styles.snapRow}>
                <div className={styles.snapField}>
                  <label className={styles.snapLabel}>FIRMA</label>
                  <input className={styles.snapInput} value={snapForm.companyName} onChange={(e) => setSnapForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="Firma GmbH" />
                </div>
                <div className={styles.snapField}>
                  <label className={styles.snapLabel}>NAME</label>
                  <input className={styles.snapInput} value={snapForm.contactName} onChange={(e) => setSnapForm((f) => ({ ...f, contactName: e.target.value }))} placeholder="Max Mustermann" />
                </div>
              </div>
              <div className={styles.snapRow}>
                <div className={styles.snapField} style={{ flex: 2 }}>
                  <label className={styles.snapLabel}>STRASSE</label>
                  <input className={styles.snapInput} value={snapForm.street} onChange={(e) => setSnapForm((f) => ({ ...f, street: e.target.value }))} placeholder="Musterstraße 1" />
                </div>
                <div className={styles.snapField} style={{ flex: 1 }}>
                  <label className={styles.snapLabel}>PLZ</label>
                  <input className={styles.snapInput} value={snapForm.zip} onChange={(e) => setSnapForm((f) => ({ ...f, zip: e.target.value }))} placeholder="80331" />
                </div>
              </div>
              <div className={styles.snapRow}>
                <div className={styles.snapField}>
                  <label className={styles.snapLabel}>STADT</label>
                  <input className={styles.snapInput} value={snapForm.city} onChange={(e) => setSnapForm((f) => ({ ...f, city: e.target.value }))} placeholder="München" />
                </div>
                <div className={styles.snapField}>
                  <label className={styles.snapLabel}>LAND</label>
                  <input className={styles.snapInput} value={snapForm.country} onChange={(e) => setSnapForm((f) => ({ ...f, country: e.target.value }))} placeholder="Deutschland" />
                </div>
              </div>
              <div className={styles.snapActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setEditingSnap(false)}>Abbrechen</button>
                <button type="submit" className={styles.btnSave} disabled={snapSaving}>{snapSaving ? "Speichern…" : "Speichern"}</button>
              </div>
            </form>
          )}

          {/* Items table */}
          {!editingItems ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div />
                {invoice.status !== "draft" && invoice.status !== "canceled" && (
                  <button className={styles.btnEditSnap} onClick={openItemsEdit}>
                    ✎ Positionen korrigieren
                  </button>
                )}
              </div>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>BEZEICHNUNG</th>
                    <th style={{ textAlign: "center" }}>MENGE</th>
                    <th style={{ textAlign: "right" }}>EINZELPREIS</th>
                    <th style={{ textAlign: "right" }}>BETRAG</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.title}</td>
                      <td style={{ textAlign: "center" }}>{item.qty}</td>
                      <td style={{ textAlign: "right" }}>{fmt(item.unitPrice)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(item.qty * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <form className={styles.snapForm} onSubmit={saveItems} style={{ marginTop: 8 }}>
              <div className={styles.snapFormTitle}>Positionen korrigieren</div>

              {/* Date fields */}
              <div className={styles.snapRow} style={{ marginBottom: 12 }}>
                <div className={styles.snapField}>
                  <label className={styles.snapLabel}>RECHNUNGSDATUM</label>
                  <input
                    type="date"
                    className={styles.snapInput}
                    value={issuedAtInput}
                    onChange={(e) => setIssuedAtInput(e.target.value)}
                  />
                </div>
                <div className={styles.snapField}>
                  <label className={styles.snapLabel}>FÄLLIG BIS</label>
                  <input
                    type="date"
                    className={styles.snapInput}
                    value={dueAtInput}
                    onChange={(e) => setDueAtInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Items editor */}
              <table className={styles.itemsTable} style={{ marginBottom: 8 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>BEZEICHNUNG</th>
                    <th style={{ textAlign: "center", width: 64 }}>MENGE</th>
                    <th style={{ textAlign: "right", width: 120 }}>EINZELPREIS</th>
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {itemsForm.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          className={styles.snapInput}
                          style={{ width: "100%" }}
                          value={item.title}
                          onChange={(e) => updateItem(i, "title", e.target.value)}
                          placeholder="Leistungsbeschreibung"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className={styles.snapInput}
                          style={{ width: 56, textAlign: "center" }}
                          value={item.qty}
                          onChange={(e) => updateItem(i, "qty", e.target.value)}
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className={styles.snapInput}
                          style={{ width: 110, textAlign: "right" }}
                          value={item.unitPrice}
                          onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                          required
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className={styles.btnCancel}
                          style={{ padding: "2px 8px", fontSize: 13 }}
                          onClick={() => removeItem(i)}
                          title="Position entfernen"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                className={styles.btnEditSnap}
                style={{ marginBottom: 12 }}
                onClick={addItem}
              >
                + Position hinzufügen
              </button>

              <div className={styles.snapActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setEditingItems(false)}>Abbrechen</button>
                <button type="submit" className={styles.btnSave} disabled={itemsSaving || itemsForm.length === 0}>
                  {itemsSaving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </form>
          )}

          {/* Totals */}
          <div className={styles.totals}>
            <div className={styles.totalLine}>
              <span>Zwischensumme</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className={styles.totalLine}>
              <span>MwSt. (0%)</span>
              <span>0,00 €</span>
            </div>
            <div className={styles.totalFinal}>
              <span>Gesamtbetrag</span>
              <span className={styles.totalFinalValue}>{fmt(invoice.total)}</span>
            </div>
          </div>

          {/* §19 note */}
          <div className={styles.kleinNote}>
            {invoice.kleinunternehmerText || "Gemäß §19 UStG wird keine Umsatzsteuer berechnet."}
          </div>
        </div>

        {/* ── Side column ── */}
        <div className={styles.sideCol}>
          {/* Actions */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardLabel}>AKTIONEN</div>
            {error && <div className={styles.formError}>{error}</div>}
            <a
              href={`/api/invoices/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className={styles.actionBtn}
            >
              📄 PDF herunterladen
            </a>
            {invoice.status === "draft" && (
              <a href={`/invoices/new?draft=${id}`} className={styles.actionBtn}>
                ✎ Entwurf bearbeiten
              </a>
            )}
            {invoice.status === "issued" && (
              <button
                className={styles.actionBtn}
                onClick={() => doAction("pay")}
                disabled={actionLoading === "pay"}
              >
                {actionLoading === "pay" ? "…" : "✓ Als bezahlt markieren"}
              </button>
            )}
            {(invoice.status === "issued" || invoice.status === "paid") && !invoice.stornoId && (
              <button
                className={styles.actionBtnDanger}
                onClick={handleStorno}
                disabled={actionLoading === "storno"}
              >
                {actionLoading === "storno" ? "…" : "↩ Stornorechnung erstellen"}
              </button>
            )}
            {invoice.status === "draft" && (
              <button
                className={styles.actionBtnDanger}
                onClick={handleDeleteDraft}
                disabled={actionLoading === "delete"}
              >
                {actionLoading === "delete" ? "…" : "🗑 Entwurf löschen"}
              </button>
            )}
            <button
              className={styles.actionBtnDanger}
              onClick={handleHardDelete}
              disabled={!!actionLoading}
              style={{ opacity: 0.7 }}
              title="Rechnung permanent aus der Datenbank löschen"
            >
              {actionLoading === "hard-delete" ? "…" : "✕ Rechnung löschen"}
            </button>
          </div>

          {/* Timeline */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardLabel}>VERLAUF</div>
            <div className={styles.timeline}>
              {timeline.map((ev, i) => (
                <div key={i} className={styles.timelineItem}>
                  <div
                    className={styles.timelineDot}
                    style={
                      ev.type === "active"
                        ? { background: "transparent", border: "2px solid #0dd3b8" }
                        : { background: "#c8f04a", border: "none" }
                    }
                  />
                  <div>
                    <div
                      className={styles.timelineLabel}
                      style={{ color: ev.type === "active" ? "#0dd3b8" : "#e6e6e6" }}
                    >
                      {ev.label}
                    </div>
                    <div className={styles.timelineDate}>{ev.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
