"use client";

import { useId, type ReactNode } from "react";
import styles from "./ui.module.css";

export interface TooltipProps {
  text: string;
  children: ReactNode;
}

/**
 * Visual hover/focus tooltip. The child element should carry its own
 * accessible name (e.g. IconButton's aria-label); the tooltip adds visible
 * context for pointer users.
 */
export function Tooltip({ text, children }: TooltipProps) {
  const id = useId();
  return (
    <span className={styles.tooltipWrap}>
      {children}
      <span role="tooltip" id={id} className={styles.tooltip}>
        {text}
      </span>
    </span>
  );
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {icon ? <div className={styles.emptyIcon} aria-hidden>{icon}</div> : null}
      <p className={styles.emptyTitle}>{title}</p>
      {description ? <p className={styles.emptyDesc}>{description}</p> : null}
      {action}
    </div>
  );
}
