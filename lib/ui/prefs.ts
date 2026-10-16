"use client";

import { useSyncExternalStore } from "react";
import type {
  NotificationPreferences,
  PrivacyPreferences,
} from "@/lib/mock/types";

/**
 * Harmless local UI preferences — the ONLY application data this prototype
 * persists. Stored in localStorage under "messenger.ui.prefs" and validated
 * on read. Never contains passwords, private keys, recovery secrets, or
 * message content.
 */
export interface LocalUiPrefs {
  displayName: string;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
}

export const DEFAULT_LOCAL_PREFS: LocalUiPrefs = {
  displayName: "You",
  notifications: {
    soundEnabled: true,
    messagePreviewEnabled: false,
  },
  privacy: {
    sendReadReceipts: true,
    typingIndicators: true,
  },
};

const STORAGE_KEY = "messenger.ui.prefs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLocalUiPrefs(value: unknown): value is LocalUiPrefs {
  if (!isRecord(value)) return false;
  const { displayName, notifications, privacy } = value;
  return (
    typeof displayName === "string" &&
    isRecord(notifications) &&
    typeof notifications.soundEnabled === "boolean" &&
    typeof notifications.messagePreviewEnabled === "boolean" &&
    isRecord(privacy) &&
    typeof privacy.sendReadReceipts === "boolean" &&
    typeof privacy.typingIndicators === "boolean"
  );
}

let cached: LocalUiPrefs | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): LocalUiPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isLocalUiPrefs(parsed)) return parsed;
    }
  } catch {
    // Storage unavailable (private mode) or corrupt JSON → defaults.
  }
  return DEFAULT_LOCAL_PREFS;
}

export function getLocalUiPrefs(): LocalUiPrefs {
  cached ??= readFromStorage();
  return cached;
}

export function setLocalUiPrefs(next: LocalUiPrefs): void {
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Persisting is best-effort; the in-memory value still applies.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getServerPrefs(): LocalUiPrefs {
  return DEFAULT_LOCAL_PREFS;
}

/** Read/write local UI preferences with SSR-safe hydration. */
export function useLocalUiPrefs(): [
  LocalUiPrefs,
  (next: LocalUiPrefs) => void,
] {
  const prefs = useSyncExternalStore(
    subscribe,
    getLocalUiPrefs,
    getServerPrefs,
  );
  return [prefs, setLocalUiPrefs];
}

/** Deterministic initials for avatar previews ("Ada Lovelace" → "AL"). */
export function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return initials.length > 0 ? initials : "U";
}
