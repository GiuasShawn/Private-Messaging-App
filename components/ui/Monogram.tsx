import styles from "./ui.module.css";

export interface MonogramProps {
  size?: number;
  /** Accessible label; omit when the brand name is rendered next to it. */
  label?: string;
}

/**
 * Brand mark: two quiet overlapping forms suggesting a private channel
 * between exactly two people. No padlocks or shields — the identity stays
 * understated.
 */
export function Monogram({ size = 28, label }: MonogramProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={styles.monogram}
    >
      <rect width="32" height="32" rx="9" fill="var(--accent-soft)" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="8.5"
        stroke="var(--accent-border)"
      />
      <path
        d="M11 22V10h2.4v4.7L18.2 10H21l-5.2 5.1L21.4 22h-2.9l-4.1-5.6-1 1V22H11Z"
        fill="var(--accent)"
      />
    </svg>
  );
}
