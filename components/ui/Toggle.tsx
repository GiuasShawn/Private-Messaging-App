"use client";

import { useId } from "react";
import styles from "./ui.module.css";
import { ChevronDownIcon } from "./icons";

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name for the switch. */
  label: string;
  disabled?: boolean;
}

/** Accessible on/off switch (role="switch"). */
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly SelectOption[];
  disabled?: boolean;
}

/**
 * Styled native <select> — native keeps keyboard and mobile behavior correct
 * without custom listbox logic.
 */
export function Select({ label, value, onChange, options, disabled }: SelectProps) {
  const id = useId();
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <span className={styles.selectWrap}>
        <select
          id={id}
          className={styles.select}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={15} className={styles.selectChevron} />
      </span>
    </>
  );
}
