import type { ReactNode } from "react";
import styles from "./ui.module.css";
import { AlertTriangleIcon, InfoIcon } from "./icons";

export interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Rendered on the right side of the header (e.g. a status badge). */
  action?: ReactNode;
  children: ReactNode;
  /** Removes inner padding (for lists that manage their own spacing). */
  flush?: boolean;
  footer?: ReactNode;
}

/** Card surface used across settings, devices, and security screens. */
export function Panel({ title, description, action, children, flush, footer }: PanelProps) {
  return (
    <section className={styles.panel}>
      {title || action ? (
        <header className={styles.panelHead}>
          <div>
            {title ? <h2 className={styles.panelTitle}>{title}</h2> : null}
            {description ? <p className={styles.panelDesc}>{description}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </header>
      ) : null}
      <div className={flush ? `${styles.panelBody} ${styles.panelBodyFlush}` : styles.panelBody}>
        {children}
      </div>
      {footer ? <div className={styles.panelHead}>{footer}</div> : null}
    </section>
  );
}

export interface SettingsRowProps {
  label: ReactNode;
  description?: ReactNode;
  control: ReactNode;
  /** Draws a divider above this row. */
  divided?: boolean;
}

/** Label/description on the left, control on the right. */
export function SettingsRow({ label, description, control, divided }: SettingsRowProps) {
  return (
    <div
      className={
        divided ? `${styles.row} ${styles.rowDivider} ${styles.rowSpaced}` : styles.row
      }
    >
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {description ? <span className={styles.rowDesc}>{description}</span> : null}
      </div>
      {control}
    </div>
  );
}

export interface CalloutProps {
  tone?: "info" | "warn";
  title?: ReactNode;
  children: ReactNode;
}

/** Explanatory note distinguishing mock behavior from future functionality. */
export function Callout({ tone = "info", title, children }: CalloutProps) {
  return (
    <div
      className={`${styles.callout} ${tone === "warn" ? styles.calloutWarn : styles.calloutInfo}`}
      role="note"
    >
      <span className={styles.calloutIcon} aria-hidden>
        {tone === "warn" ? <AlertTriangleIcon size={16} /> : <InfoIcon size={16} />}
      </span>
      <div>
        {title ? <strong className={styles.calloutTitle}>{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}
