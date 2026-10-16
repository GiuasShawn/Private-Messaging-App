"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import styles from "./shell.module.css";
import { useMockAuth } from "@/lib/ui/auth";
import { initialsFor, useLocalUiPrefs } from "@/lib/ui/prefs";
import { Avatar } from "@/components/ui/Avatar";
import { Monogram } from "@/components/ui/Monogram";
import {
  LifeBuoyIcon,
  MessageIcon,
  SettingsIcon,
  ShieldIcon,
  SignOutIcon,
  SmartphoneIcon,
} from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
  icon: (p: { size?: number; className?: string }) => ReactNode;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/chat", label: "Chat", icon: (p) => <MessageIcon {...p} /> },
  { href: "/devices", label: "Devices", icon: (p) => <SmartphoneIcon {...p} /> },
  { href: "/security", label: "Security", icon: (p) => <ShieldIcon {...p} /> },
  { href: "/recovery", label: "Recovery", icon: (p) => <LifeBuoyIcon {...p} /> },
  { href: "/settings", label: "Settings", icon: (p) => <SettingsIcon {...p} /> },
];

export interface AppShellProps {
  /** Screen title shown in the mobile header. */
  title: string;
  children: ReactNode;
}

/**
 * Responsive application frame. Desktop gets a labeled sidebar; phones get a
 * compact header and a bottom tab bar. Auth is mock, in-memory state: when
 * there is no signed-in user we redirect to /login without rendering app UI.
 */
export function AppShell({ title, children }: AppShellProps) {
  const { user, signOut } = useMockAuth();
  const [localPrefs] = useLocalUiPrefs();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const handleSignOut = () => {
    signOut();
    router.replace("/login");
  };

  if (!user) {
    return (
      <div className={styles.guardPlaceholder} role="status">
        Redirecting to sign in…
      </div>
    );
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Monogram size={30} />
          <span className={styles.brandName}>Haven</span>
          <span className={styles.brandTag}>Prototype</span>
        </div>
        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                aria-current={active ? "page" : undefined}
              >
                <span className={styles.navIcon}>
                  <Icon size={19} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.userBlock}>
          <Avatar
            initials={initialsFor(localPrefs.displayName)}
            size="sm"
            label={localPrefs.displayName.trim() || "You"}
          />
          <span className={styles.userText}>
            <span className={styles.userName}>
              {localPrefs.displayName.trim() || "You"}
            </span>
            <span className={styles.userEmail}>{user.email}</span>
          </span>
          <button
            type="button"
            className={styles.signOutButton}
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            <SignOutIcon size={17} />
          </button>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <Monogram size={26} />
        <span className={styles.mobileTitle}>{title}</span>
        <button
          type="button"
          className={styles.signOutButton}
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <SignOutIcon size={17} />
        </button>
      </header>

      <main className={styles.main}>{children}</main>

      <nav className={styles.bottomNav} aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
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
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
