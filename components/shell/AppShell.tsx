"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import styles from "./shell.module.css";
import { useMockAuth } from "@/lib/ui/auth";
import { initialsFor, useLocalUiPrefs } from "@/lib/ui/prefs";
import { Avatar } from "@/components/ui/Avatar";
import { LockIcon, SettingsIcon } from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
}

/**
 * The primary navigation is exactly three destinations. Security and
 * Recovery are intentionally not primary-nav items in this interface; their
 * underlying modules and routes remain intact for later phases.
 */
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/chat", label: "Messages" },
  { href: "/devices", label: "Devices" },
  { href: "/settings", label: "Settings" },
];

/** Brand glyph from the supplied designs: two nodes joined by a channel. */
function BrandGlyph() {
  return (
    <svg
      width="34"
      height="12"
      viewBox="0 0 34 12"
      fill="none"
      aria-hidden
      focusable="false"
      className={styles.brandGlyph}
    >
      <circle cx="5" cy="6" r="4" fill="var(--accent)" />
      <rect x="9" y="5.5" width="9" height="1" fill="var(--text-muted)" />
      <circle cx="24" cy="6" r="4" fill="var(--text-secondary)" />
    </svg>
  );
}

export interface AppShellProps {
  /** Screen title shown in the mobile header. */
  title: string;
  /** Optional extra sidebar content (e.g. the conversation list on Messages). */
  sidebarExtra?: ReactNode;
  children: ReactNode;
}

/**
 * Responsive application frame matching the supplied Haven designs. Desktop
 * gets a fixed 260px sidebar and a slim secure-status top bar; phones get a
 * compact header and a bottom tab bar. Auth is mock, in-memory state: when
 * there is no signed-in user we redirect to /login without rendering app UI.
 */
export function AppShell({ title, sidebarExtra, children }: AppShellProps) {
  const { user } = useMockAuth();
  const [localPrefs] = useLocalUiPrefs();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) {
    return (
      <div className={styles.guardPlaceholder} role="status">
        Redirecting to sign in…
      </div>
    );
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const displayName = localPrefs.displayName.trim() || "You";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div>
          <div className={styles.brand}>
            <BrandGlyph />
            <span className={styles.brandName}>haven</span>
            <span className={styles.brandTag}>Prototype</span>
          </div>
          <p className={styles.navLabel}>Navigation</p>
          <nav className={styles.nav} aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {sidebarExtra ? <div className={styles.sidebarExtra}>{sidebarExtra}</div> : null}
        </div>

        <div className={styles.sidebarFooter}>
          <p className={styles.privatePill}>
            <LockIcon size={13} />
            Your space is private
          </p>
          <div className={styles.userBlock}>
            <Avatar
              initials={initialsFor(displayName)}
              size="sm"
              label={displayName}
            />
            <span className={styles.userText}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.userMeta}>E2EE Active · prototype</span>
            </span>
            <Link
              href="/settings"
              className={styles.userAction}
              aria-label="Open settings"
            >
              <SettingsIcon size={16} />
            </Link>
          </div>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <span className={styles.topbarBrand}>
            <BrandGlyph />
            <span className={styles.topbarWord}>haven</span>
          </span>
          <span className={styles.secureIndicator}>
            <span className={styles.secureDot} aria-hidden />
            <span className={styles.secureWord}>SECURE</span>
            <span className={styles.secureSep} aria-hidden>
              ·
            </span>
            <span className={styles.secureKey}>
              mock session · key: 8f4e..2a9c
            </span>
          </span>
          <span className={styles.topbarTitle}>{title}</span>
        </header>

        <main className={styles.main}>{children}</main>

        <nav className={styles.bottomNav} aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? `${styles.bottomNavItem} ${styles.bottomNavItemActive}`
                    : styles.bottomNavItem
                }
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
