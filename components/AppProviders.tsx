"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/lib/ui/theme";
import { MockAuthProvider } from "@/lib/ui/auth";

/** Client-side providers for the UI prototype (theme + mock auth). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <MockAuthProvider>{children}</MockAuthProvider>
    </ThemeProvider>
  );
}
