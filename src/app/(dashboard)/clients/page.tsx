"use client";
import { useState, useEffect, useRef } from "react";
import styles from "./clients.module.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const AVATAR_COLORS = ["#c8f04a", "#0dd3b8", "#f0215d", "#4a90e2", "#9b5cf5", "#f0952d"];
function avatarColor(name: string) {
  const sum = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const STATUS_COLOR: Record<string, string> = {
  paid: "#c8f04a",
  issued: "#f0952d",
  draft: "#666",
  canceled: "#f0215d",
};

type Client = {
  _id: string;
  companyName?: string;
  contactName?: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  email?: string;
};

type Stats = { umsatz: number; count: number; lastStatus: string | null };

const EMPTY_FORM = {
  companyName: "",
  contactName: "",
  street: "",
  zip: "",
  city: "",
  country: "Deutschland",
  email: "",
  phone: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load(search: string) {
    setLoading(true);
    Promise.all([
      fetch(`/api/clients${search ? `?q=${encodeURIComponent(search)}` : ""}`).then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
    ])
      .then(([clientRes, invRes]) => {
        const clientList: Client[] = clientRes.data ?? [];
        setClients(clientList);
        const computed: Record<string, Stats> = {};
        for (const inv of invRes.data ?? []) {
          const cid = String(inv.clientId ?? "");
          if (!cid) continue;
          if (!computed[cid]) computed[cid] = { umsatz: 0, count: 0, lastStatus: null };
          computed[cid].count++;
          if (inv.status === "paid") computed[cid].umsatz += inv.total;
          if (!computed[cid].lastStatus) computed[cid].lastStatus = inv.status;
        }
        setStats(computed);
      })
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
    setError(null);
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim() && !form.contactName.trim()) {
      setError("Bitte Name oder Firma angeben.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    setSaving(false);
    if (res.success && res.data) {
      setClients((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } else {
      setError(res.error ?? "Fehler beim Speichern.");
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pageLabel}>KUNDEN</div>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>Kunden</h1>
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
              + Neuer Kunde
            </button>
          </div>
        </div>

        {/* Inline new-client form */}
        {showForm && (
          <form className={styles.newForm} onSubmit={handleCreate}>
            <div className={styles.newFormTitle}>Neuer Kunde</div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>NAME / ANSPRECHPARTNER <span className={styles.requiredHint}>*</span></label>
              <input className={styles.formInput} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="z.B. Maria Muster" />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>FIRMA <span className={styles.optionalHint}>(optional)</span></label>
              <input className={styles.formInput} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="z.B. Muster GmbH – leer lassen für Privatpersonen" />
            </div>
            <div className={styles.formRow2}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>STRASSE</label>
                <input className={styles.formInput} value={form.street} onChange={(e) => set("street", e.target.value)} placeholder="Musterstraße 1" />
              </div>
              <div className={styles.formRow} style={{ maxWidth: 120 }}>
                <label className={styles.formLabel}>PLZ</label>
                <input className={styles.formInput} value={form.zip} onChange={(e) => set("zip", e.target.value)} placeholder="80331" />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>STADT</label>
                <input className={styles.formInput} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="München" />
              </div>
            </div>
            <div className={styles.formRow2}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>E-MAIL</label>
                <input className={styles.formInput} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="info@muster.de" />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>TELEFON</label>
                <input className={styles.formInput} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+49 89 123456" />
              </div>
            </div>
            {error && <div className={styles.formError}>{error}</div>}
            <div className={styles.formActions}>
              <button type="button" className={styles.btnCancel} onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}>
                Abbrechen
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? "Speichern…" : "Kunde anlegen"}
              </button>
            </div>
          </form>
        )}

        {/* Client grid */}
        <div className={styles.grid}>
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className={`${styles.clientCard} ${styles.skeleton}`} />)
          ) : (
            <>
              {clients.map((c) => {
                const name = c.companyName || c.contactName || "?";
                const color = avatarColor(name);
                const s = stats[c._id] ?? { umsatz: 0, count: 0, lastStatus: null };
                return (
                  <div key={c._id} className={styles.clientCard} onClick={() => {}}>
                    <div className={styles.avatar} style={{ background: color, color: "#111" }}>
                      {initials(name)}
                    </div>
                    <div className={styles.clientName}>{name}</div>
                    {c.companyName && c.contactName && (
                      <div className={styles.clientContact}>{c.contactName}</div>
                    )}
                    <div className={styles.clientLocation}>
                      📍 {c.city}, {c.country}
                    </div>
                    <div className={styles.divider} />
                    <div className={styles.clientStats}>
                      <div>
                        <div className={styles.statValue} style={{ color: "#c8f04a" }}>
                          {fmt(s.umsatz)}
                        </div>
                        <div className={styles.statLabel}>Umsatz</div>
                      </div>
                      <div>
                        <div className={styles.statValue}>{s.count}</div>
                        <div className={styles.statLabel}>Rechnungen</div>
                      </div>
                      <div>
                        <div
                          className={styles.statValue}
                          style={{ color: s.lastStatus ? STATUS_COLOR[s.lastStatus] : "#666" }}
                        >
                          {s.lastStatus ?? "–"}
                        </div>
                        <div className={styles.statLabel}>Letzter Status</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* New client placeholder card */}
              <button
                className={styles.newCard}
                onClick={() => { setShowForm(true); setError(null); }}
              >
                <div className={styles.newCardPlus}>+</div>
                <div className={styles.newCardLabel}>Neuer Kunde</div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
