"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { MockUser } from "@/lib/mock/types";

export type SignInResult = { ok: true } | { ok: false; message: string };

interface MockAuthValue {
  user: MockUser | null;
  signingIn: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
}

const MockAuthContext = createContext<MockAuthValue | null>(null);

/** Simulated network delay so the UI can render its loading state honestly. */
const MOCK_SIGN_IN_DELAY_MS = 650;

function deriveDisplayName(email: string): string {
  const local = email.split("@")[0] ?? "you";
  const words = local
    .replace(/[._\-+]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(" ") || "You";
}

function initialsOf(displayName: string): string {
  const letters = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase());
  return letters.join("") || "U";
}

/**
 * MOCK authentication — Phase 1 only.
 *
 * - There is no account system, no backend, and no credential checking
 *   beyond shape validation. Any email with a password of 8+ characters is
 *   accepted, and the UI states this plainly.
 * - The signed-in user lives in React memory only. Refreshing the page
 *   returns to the sign-in screen; nothing is persisted.
 * - The password parameter is used for validation and then discarded. It is
 *   never stored, logged, persisted, or transmitted.
 */
export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      if (!email.includes("@") || email.trim().length < 3) {
        return { ok: false, message: "Enter a valid email address." };
      }
      if (password.length < 8) {
        return {
          ok: false,
          message: "Password must be at least 8 characters (demo rule).",
        };
      }
      setSigningIn(true);
      // Simulated latency only; no request is made and nothing is sent.
      await new Promise((resolve) => setTimeout(resolve, MOCK_SIGN_IN_DELAY_MS));
      const displayName = deriveDisplayName(email.trim());
      setUser({
        id: "mock-user",
        email: email.trim(),
        displayName,
        initials: initialsOf(displayName),
      });
      setSigningIn(false);
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(() => setUser(null), []);

  return (
    <MockAuthContext.Provider value={{ user, signingIn, signIn, signOut }}>
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth(): MockAuthValue {
  const ctx = useContext(MockAuthContext);
  if (!ctx) throw new Error("useMockAuth must be used within a MockAuthProvider");
  return ctx;
}
