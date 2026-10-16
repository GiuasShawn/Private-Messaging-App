"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ThemePreference } from "@/lib/mock/types";

/** Harmless UI preference — the only theme-related thing persisted. */
const STORAGE_KEY = "messenger.ui.theme";

interface ThemeValue {
  theme: ThemePreference;
  setTheme: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * The applied theme lives on <html data-theme> (written by the pre-hydration
 * script /theme-init.js and by setTheme). Reading it through
 * useSyncExternalStore with a MutationObserver keeps React state in sync with
 * the DOM without setState-in-effect patterns, and gives the server a stable
 * "dark" snapshot (the default theme) so hydration stays consistent.
 */
function subscribe(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): ThemePreference {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function getServerSnapshot(): ThemePreference {
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: ThemePreference) => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the DOM theme still applies.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
