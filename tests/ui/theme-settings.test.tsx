/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/ui/theme";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { AppShell } from "@/components/shell/AppShell";

const { replace, pathname } = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/chat",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
}));
vi.mock("@/lib/ui/auth", () => ({
  useMockAuth: () => ({
    user: {
      id: "mock-user",
      email: "ada@example.com",
      displayName: "Ada",
      initials: "AD",
    },
    signingIn: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.setAttribute("data-theme", "dark");
});

describe("theme selection", () => {
  it("switches data-theme and persists the harmless preference", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("messenger.ui.theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("messenger.ui.theme")).toBe("dark");
  });
});

describe("general settings", () => {
  it("edits the display name with a live avatar preview and persists it", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );

    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Grace Hopper");

    expect(screen.getByRole("img", { name: "Grace Hopper" })).toBeInTheDocument();
    expect(screen.getByText(/Grace Hopper/)).toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem("messenger.ui.prefs") ?? "{}",
    );
    expect(stored.displayName).toBe("Grace Hopper");
  });

  it("toggles notification and privacy preferences", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );

    const sound = screen.getByRole("switch", { name: "Notification sound" });
    expect(sound).toHaveAttribute("aria-checked", "true");
    await user.click(sound);
    expect(sound).toHaveAttribute("aria-checked", "false");

    const receipts = screen.getByRole("switch", {
      name: "Send read receipts from settings",
    });
    await user.click(receipts);
    expect(receipts).toHaveAttribute("aria-checked", "false");

    const stored = JSON.parse(
      window.localStorage.getItem("messenger.ui.prefs") ?? "{}",
    );
    expect(stored.notifications.soundEnabled).toBe(false);
    expect(stored.privacy.sendReadReceipts).toBe(false);
  });
});

describe("responsive navigation", () => {
  it("renders all destinations in sidebar and bottom nav with current-page state", () => {
    render(
      <ThemeProvider>
        <AppShell title="Chat">
          <p>screen content</p>
        </AppShell>
      </ThemeProvider>,
    );

    // Sidebar + bottom tab bar each expose every destination.
    for (const label of ["Chat", "Devices", "Security", "Recovery", "Settings"]) {
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThanOrEqual(1);
    }

    for (const chatLink of screen.getAllByRole("link", { name: "Chat" })) {
      expect(chatLink).toHaveAttribute("aria-current", "page");
    }
    for (const devicesLink of screen.getAllByRole("link", { name: "Devices" })) {
      expect(devicesLink).not.toHaveAttribute("aria-current");
    }

    expect(screen.getByText("screen content")).toBeInTheDocument();
    // Sign-out affordance exists in both the sidebar and the mobile header.
    expect(
      screen.getAllByRole("button", { name: "Sign out" }).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
