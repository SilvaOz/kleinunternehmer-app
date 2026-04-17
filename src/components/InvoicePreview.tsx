import styles from "./InvoicePreview.module.css";

interface FirmaData {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  taxNumber: string;
  iban: string;
  bic: string;
  bankName: string;
  accountHolder: string;
  phone: string;
  email: string;
}

const fmt = (d: Date) =>
  d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function InvoicePreview({ firma }: { firma: FirmaData }) {
  const today = new Date();
  const due   = new Date(today.getTime() + 28 * 86_400_000);
  const year  = today.getFullYear();

  const companyName = firma.name.trim()  || null;
  const holder      = (firma.accountHolder || firma.name).trim() || null;
  const hasAddress  = firma.street || firma.zip || firma.city;
  const hasBank     = firma.iban || firma.bic;

  const footerParts = [
    companyName,
    firma.street || null,
    (firma.zip || firma.city) ? `${firma.zip} ${firma.city}`.trim() : null,
  ].filter(Boolean);

  return (
    <div className={styles.paper}>

      {/* ── Hero / Briefkopf ── */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          {companyName
            ? <span className={styles.heroFallback}>{companyName}</span>
            : <span className={`${styles.heroFallback} ${styles.placeholder}`}>Dein Firmenname</span>
          }
        </div>

        <div className={styles.heroSep} />

        <div className={styles.heroRight}>
          <span className={styles.heroTag}>RECHNUNG</span>

          {companyName
            ? <div className={styles.heroCompany}>{companyName}</div>
            : <div className={`${styles.heroCompany} ${styles.placeholder}`}>Dein Firmenname</div>
          }

          {hasAddress ? (
            <>
              {firma.street && <div className={styles.heroMeta}>{firma.street}</div>}
              {(firma.zip || firma.city) && (
                <div className={styles.heroMeta}>{firma.zip} {firma.city}</div>
              )}
            </>
          ) : (
            <div className={styles.heroMetaMuted}>Straße · PLZ Stadt</div>
          )}

          {firma.taxNumber
            ? <div className={styles.heroMeta}>Steuernummer: {firma.taxNumber}</div>
            : <div className={styles.heroMetaMuted}>Steuernummer: 12/345/67890</div>
          }

          {firma.iban && <div className={styles.heroMeta}>IBAN: {firma.iban}</div>}
          {firma.bic  && <div className={styles.heroMeta}>BIC: {firma.bic}</div>}
        </div>
      </div>

      {/* ── Yellow accent ── */}
      <div className={styles.accent} />

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Recipient + meta */}
        <div className={styles.topSection}>
          <div className={styles.recipient}>
            <div className={styles.recipientLabel}>EMPFÄNGER</div>
            <div className={styles.recipientName}>Musterkunde GmbH</div>
            <div className={styles.recipientLine}>Musterstraße 42</div>
            <div className={styles.recipientLine}>10115 Berlin</div>
          </div>
          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Rechnungsnummer:</span>
              <span className={styles.metaValue}>{year}-001</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Rechnungsdatum:</span>
              <span className={styles.metaValue}>{fmt(today)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Fällig bis:</span>
              <span className={styles.metaValue}>{fmt(due)}</span>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className={styles.sectionTitle}>Erbrachte Leistungen</div>
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHead}>
              <th className={styles.thPos}>Pos.</th>
              <th className={styles.thDesc}>Leistung</th>
              <th className={styles.thNum}>Menge</th>
              <th className={styles.thNum}>Einzelpreis</th>
              <th className={styles.thNum}>Betrag</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.tableRow}>
              <td className={styles.tdPos}>1</td>
              <td className={styles.tdDesc}>Beratung / Dienstleistung</td>
              <td className={styles.tdNum}>1</td>
              <td className={styles.tdNum}>1.000,00&nbsp;€</td>
              <td className={styles.tdNum}>1.000,00&nbsp;€</td>
            </tr>
            <tr className={`${styles.tableRow} ${styles.tableRowFoot}`}>
              <td className={styles.tdPos} />
              <td className={styles.tdDesc} style={{ fontWeight: 700 }}>Gesamt</td>
              <td className={styles.tdNum} />
              <td className={styles.tdNum} />
              <td className={styles.tdNum} style={{ fontWeight: 700 }}>1.000,00&nbsp;€</td>
            </tr>
          </tbody>
        </table>

        {/* Total block */}
        <div className={styles.totalBlock}>
          <span className={styles.totalLabel}>Gesamtbetrag</span>
          <span className={styles.totalAmount}>1.000,00 EUR</span>
        </div>

        {/* §19 */}
        <div className={styles.legalText}>
          Gemäß §19 UStG wird keine Umsatzsteuer berechnet.
        </div>

        {/* Payment info */}
        {hasBank ? (
          <div className={styles.payBlock}>
            <div className={styles.payHint}>
              Bitte überweisen Sie den Gesamtbetrag auf folgendes Konto:
            </div>
            {holder && (
              <div className={styles.payRow}>
                <span className={styles.payLabel}>Kontoinhaber:</span>
                <span className={styles.payValue}>{holder}</span>
              </div>
            )}
            {firma.iban && (
              <div className={styles.payRow}>
                <span className={styles.payLabel}>IBAN:</span>
                <span className={styles.payValue}>{firma.iban}</span>
              </div>
            )}
            {firma.bic && (
              <div className={styles.payRow}>
                <span className={styles.payLabel}>BIC:</span>
                <span className={styles.payValue}>{firma.bic}</span>
              </div>
            )}
            {firma.bankName && (
              <div className={styles.payRow}>
                <span className={styles.payLabel}>Bank:</span>
                <span className={styles.payValue}>{firma.bankName}</span>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.payBlock}>
            <div className={`${styles.payHint} ${styles.placeholder}`}>
              Bankverbindung nicht angegeben – füge IBAN und BIC hinzu.
            </div>
          </div>
        )}

        {/* Closing */}
        <div className={styles.closingText}>
          Herzlichen Dank für Ihr Vertrauen und die Zusammenarbeit!
        </div>
        <div className={styles.closingName}>
          {holder ?? <span className={styles.placeholder}>Dein Name</span>}
        </div>

      </div>

      {/* ── Footer ── */}
      <div className={styles.footer}>
        {footerParts.length > 0
          ? footerParts.join(" · ")
          : <span className={styles.placeholder}>Firmenname · Straße · PLZ Stadt</span>
        }
      </div>
    </div>
  );
}
