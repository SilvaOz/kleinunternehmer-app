"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./new.module.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

type Client = {
  _id: string;
  companyName?: string;
  contactName?: string;
  street: string;
  zip: string;
  city: string;
  country: string;
};

type Item = { title: string; qty: number; unitPrice: number };

export default function InvoiceNewPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [currency] = useState("EUR");
  const [items, setItems] = useState<Item[]>([{ title: "", qty: 1, unitPrice: 0 }]);
  const [footerText, setFooterText] = useState("Vielen Dank für Ihren Auftrag.");
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((res) => {
        const list: Client[] = res.data ?? [];
        setClients(list);
        if (list.length > 0) setClientId(list[0]._id);
      })
      .catch(() => {});
  }, []);

  function selectedClient() {
    return clients.find((c) => c._id === clientId) ?? null;
  }

  function addItem() {
    setItems((prev) => [...prev, { title: "", qty: 1, unitPrice: 0 }]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, k: keyof Item, v: string | number) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
  }

  const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);

  async function buildPayload() {
    return {
      clientId: clientId || undefined,
      dueAt: dueAt || undefined,
      footerText: footerText || undefined,
      items: items
        .filter((it) => it.title.trim())
        .map((it) => ({ title: it.title, qty: it.qty, unitPrice: it.unitPrice, lines: [] })),
    };
  }

  async function handleDraft() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await buildPayload()),
    }).then((r) => r.json());
    setSaving(false);
    if (res.success && res.data) {
      router.push("/invoices");
    } else {
      setError(res.error ?? "Fehler beim Speichern.");
    }
  }

  async function handleIssue() {
    setIssuing(true);
    setError(null);
    const createRes = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await buildPayload()),
    }).then((r) => r.json());
    if (!createRes.success || !createRes.data) {
      setError(createRes.error ?? "Fehler beim Erstellen.");
      setIssuing(false);
      return;
    }
    const id = createRes.data._id;
    const issueRes = await fetch(`/api/invoices/${id}/issue`, {
      method: "POST",
    }).then((r) => r.json());
    setIssuing(false);
    if (issueRes.success) {
      router.push(`/invoices/${id}`);
    } else {
      setError(issueRes.error ?? "Fehler beim Ausstellen.");
    }
  }

  const c = selectedClient();

  return (
    <div className={styles.wrap}>
      <div className={styles.pageLabel}>RECHNUNG ERSTELLEN</div>
      <div className={styles.layout}>
        {/* ── Left: Form ── */}
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <h1 className={styles.formTitle}>Neue Rechnung</h1>
            <span className={styles.draftBadge}>● draft</span>
          </div>

          {error && <div className={styles.formError}>{error}</div>}

          {/* Client selector */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>KUNDE</label>
            <div className={styles.clientSelect}>
              <select
                className={styles.selectInput}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">– Kein Kunde –</option>
                {clients.map((cl) => (
                  <option key={cl._id} value={cl._id}>
                    {cl.companyName || cl.contactName}
                  </option>
                ))}
              </select>
              {c && (
                <div className={styles.clientAddr}>
                  {c.street} · {c.zip} {c.city}
                </div>
              )}
            </div>
          </div>

          {/* Date & currency */}
          <div className={styles.row2}>
            <div className={styles.section}>
              <label className={styles.sectionLabel}>FÄLLIG BIS</label>
              <input
                className={styles.textInput}
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className={styles.section}>
              <label className={styles.sectionLabel}>WÄHRUNG</label>
              <input className={styles.textInput} value={currency} readOnly />
            </div>
          </div>

          {/* Items */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>POSITIONEN</label>
            <div className={styles.itemsHeader}>
              <span style={{ flex: 3 }}>BEZEICHNUNG</span>
              <span style={{ flex: 1, textAlign: "center" }}>MENGE</span>
              <span style={{ flex: 1, textAlign: "center" }}>EINZELPREIS</span>
              <span style={{ flex: 1, textAlign: "right" }}>BETRAG</span>
              <span style={{ width: 24 }} />
            </div>
            {items.map((item, i) => (
              <div key={i} className={styles.itemRow}>
                <div style={{ flex: 3 }}>
                  <input
                    className={styles.textInput}
                    placeholder="Bezeichnung…"
                    value={item.title}
                    onChange={(e) => updateItem(i, "title", e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    className={`${styles.textInput} ${styles.center}`}
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateItem(i, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    className={`${styles.textInput} ${styles.center}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice || ""}
                    onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className={styles.lineTotal} style={{ flex: 1 }}>
                  {fmt(item.qty * item.unitPrice)}
                </div>
                {items.length > 1 && (
                  <button className={styles.removeBtn} onClick={() => removeItem(i)}>×</button>
                )}
              </div>
            ))}
            <button className={styles.addItemBtn} onClick={addItem}>
              + Position
            </button>
          </div>

          {/* Footer */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>FUSSNOTE (OPTIONAL)</label>
            <textarea
              className={styles.textarea}
              rows={2}
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Vielen Dank für Ihren Auftrag."
            />
          </div>
        </div>

        {/* ── Right: Summary ── */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>Zusammenfassung</div>
          <div className={styles.summaryLine}>
            <span>Zwischensumme</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className={styles.summaryLine}>
            <span>MwSt. (0%)</span>
            <span>0,00 €</span>
          </div>
          <div className={styles.summaryTotal}>
            <span>Gesamt</span>
            <span className={styles.totalValue}>{fmt(subtotal)}</span>
          </div>
          <div className={styles.kleinNote}>
            Gemäß §19 UStG wird keine Umsatzsteuer berechnet.
          </div>
          <button
            className={styles.btnDraft}
            onClick={handleDraft}
            disabled={saving || issuing}
          >
            {saving ? "Speichern…" : "💾 Entwurf speichern"}
          </button>
          <button
            className={styles.btnIssue}
            onClick={handleIssue}
            disabled={saving || issuing || !clientId}
          >
            {issuing ? "Ausstellen…" : "✓ Ausstellen & sperren"}
          </button>
          {!clientId && (
            <div className={styles.issueHint}>Kunde auswählen zum Ausstellen</div>
          )}
        </div>
      </div>
    </div>
  );
}
