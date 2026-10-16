"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  /** Optional leading icon (decorative). */
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — required, icons alone are not self-describing. */
  label: string;
  size?: "sm" | "md";
  children: ReactNode;
}

export function IconButton({
  label,
  size = "sm",
  children,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const classes = [
    styles.iconButton,
    size === "md" ? styles.iconMd : styles.iconSm,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={classes} aria-label={label} {...rest}>
      {children}
    </button>
  );
}
