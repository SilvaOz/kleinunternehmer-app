"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import styles from "@/components/layout/DashboardShell.module.css";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ibanMissing, setIbanMissing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          const iban = res.data.company?.iban ?? "";
          setIbanMissing(!iban.trim());
        }
      })
      .catch(() => {});
  }, [pathname]); // re-check after navigation (e.g. user just saved settings)

  const showBanner = ibanMissing && !bannerDismissed && pathname !== "/settings";

  return (
    <>
      <header className={styles.mobileHeader}>
        <button className={styles.hamburger} onClick={() => setSidebarOpen(true)} aria-label="Menu">
          ☰
        </button>
        <span className={styles.mobileLogo}>InvoiceOS</span>
      </header>

      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={styles.main}>
        {showBanner && (
          <div className={styles.ibanBanner}>
            <span className={styles.ibanBannerIcon}>🏦</span>
            <span className={styles.ibanBannerText}>
              Bankverbindung fehlt – füge deine IBAN hinzu, damit sie auf deinen Rechnungen erscheint.
            </span>
            <Link href="/settings" className={styles.ibanBannerBtn} onClick={() => setBannerDismissed(true)}>
              Jetzt einrichten →
            </Link>
            <button
              className={styles.ibanBannerClose}
              onClick={() => setBannerDismissed(true)}
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </main>
    </>
  );
}
