import type { ReactNode } from "react";
import styles from "./ui.module.css";

export interface AvatarProps {
  initials: string;
  size?: "sm" | "md" | "lg";
  /** Presence dot shown in the corner; omit for a plain avatar. */
  presence?: "online" | "offline";
  /**
   * Accessible name. When omitted the avatar is treated as decorative — use
   * that only when the person's name is rendered adjacent to it.
   */
  label?: string;
}

export function Avatar({ initials, size = "md", presence, label }: AvatarProps) {
  const sizeClass =
    size === "lg" ? styles.avatarLg : size === "sm" ? styles.avatarSm : styles.avatarMd;
  return (
    <span
      className={`${styles.avatar} ${sizeClass}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {initials}
      {presence ? (
        <span
          aria-hidden
          className={`${styles.presenceDot} ${
            presence === "online" ? styles.presenceOnline : styles.presenceOffline
          }`}
        />
      ) : null}
    </span>
  );
}

export type BadgeTone = "neutral" | "accent" | "success" | "warn" | "danger";

const toneClass: Record<BadgeTone, string | undefined> = {
  neutral: styles.badgeNeutral,
  accent: styles.badgeAccent,
  success: styles.badgeSuccess,
  warn: styles.badgeWarn,
  danger: styles.badgeDanger,
};

export interface StatusBadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${toneClass[tone] ?? ""}`}>
      <span className={styles.badgeDot} aria-hidden />
      {children}
    </span>
  );
}
