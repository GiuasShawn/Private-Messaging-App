"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./ui.module.css";
import { IconButton } from "./Button";
import { AlertTriangleIcon, EyeIcon, EyeOffIcon } from "./icons";

/** Labeled wrapper for a form control. The control receives its own ids. */
export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p className={styles.error} id={`${htmlFor}-error`} role="alert">
          <AlertTriangleIcon size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid, className, ...rest }: TextInputProps) {
  const classes = [styles.input, invalid ? styles.inputInvalid : null, className]
    .filter(Boolean)
    .join(" ");
  return (
    <input className={classes} aria-invalid={invalid || undefined} {...rest} />
  );
}

export interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

/**
 * Password input with a visibility toggle. The toggle is a real button with an
 * accessible name and pressed state; typing is never interrupted by it.
 */
export function PasswordField({
  label = "Password",
  error,
  id,
  ...inputProps
}: PasswordFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <TextInput
          {...inputProps}
          id={inputId}
          type={visible ? "text" : "password"}
          invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <span className={styles.inputAdornment}>
          <IconButton
            label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </IconButton>
        </span>
      </div>
      {error ? (
        <p className={styles.error} id={`${inputId}-error`} role="alert">
          <AlertTriangleIcon size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
