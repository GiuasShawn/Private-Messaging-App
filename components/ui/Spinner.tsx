import styles from "./ui.module.css";

export interface SpinnerProps {
  size?: number;
  /** When provided, announces the spinner to assistive technology. */
  label?: string;
}

export function Spinner({ size = 20, label }: SpinnerProps) {
  const svg = (
    <svg
      className={styles.spinner}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.4"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
  if (!label) return svg;
  return (
    <span role="status">
      <span className="sr-only">{label}</span>
      {svg}
    </span>
  );
}
