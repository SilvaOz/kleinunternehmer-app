"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "@/components/layout/Sidebar.module.css";

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: Props) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [openCount, setOpenCount] = useState(0);
  const [companyName, setCompanyName] = useState("");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  useEffect(() => {
    fetch("/api/invoices?status=issued")
      .then((r) => r.json())
      .then((res) => setOpenCount((res.data ?? []).length))
      .catch(() => {});
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setCompanyName(res.data.company?.name || res.data.email || "");
        }
      })
      .catch(() => {});
  }, []);

  const nav = [
    { icon: "⬡", label: "Dashboard", href: "/" },
    { icon: "◈", label: "Rechnungen", href: "/invoices", badge: openCount },
    { icon: "◇", label: "Kunden", href: "/clients" },
    { icon: "◉", label: "Ausgaben", href: "/expenses" },
    { icon: "▦", label: "EÜR / Reports", href: "/reports" },
    { icon: "◎", label: "Einstellungen", href: "/settings" },
  ];

  const initials = companyName.trim() ? companyName.trim()[0].toUpperCase() : "?";

  return (
    <aside className={styles.sidebar} data-open={isOpen}>
      <div>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <div className={styles.logo}>InvoiceOS</div>
            <div className={styles.subtitle}>Kleinunternehmer</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        <nav className={styles.nav}>
          {nav.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} className={`${styles.item} ${active ? styles.active : ""}`}>
                <div>{n.icon}</div>
                <div className={styles.label}>{n.label}</div>
                {n.badge ? <span className={styles.badge}>{n.badge}</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.bottom}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.bottomInfo}>
          <div className={styles.company}>{companyName}</div>
          <div className={styles.small}>§19 UStG</div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout} title="Abmelden">
          ⏻
        </button>
      </div>
    </aside>
  );
}
