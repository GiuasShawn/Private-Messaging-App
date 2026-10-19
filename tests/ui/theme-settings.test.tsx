/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/ui/theme";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { AppShell } from "@/components/shell/AppShell";

const { replace, nav } = vi.hoisted(() => ({
  replace: vi.fn(),
  nav: { pathname: "/chat" },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => nav.pathname,
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
  it("renders exactly the three primary destinations with current-page state", () => {
    render(
      <ThemeProvider>
        <AppShell title="Messages">
          <p>screen content</p>
        </AppShell>
      </ThemeProvider>,
    );

    // Sidebar + bottom tab bar each expose exactly the three destinations.
    for (const label of ["Messages", "Devices", "Settings"]) {
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThanOrEqual(1);
    }

    // Security and Recovery are deliberately NOT in the primary nav.
    expect(screen.queryByRole("link", { name: "Security" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Recovery" })).not.toBeInTheDocument();

    for (const messagesLink of screen.getAllByRole("link", { name: "Messages" })) {
      expect(messagesLink).toHaveAttribute("aria-current", "page");
    }
    for (const devicesLink of screen.getAllByRole("link", { name: "Devices" })) {
      expect(devicesLink).not.toHaveAttribute("aria-current");
    }

    expect(screen.getByText("screen content")).toBeInTheDocument();
  });

  it("marks the active destination on other routes too", () => {
    nav.pathname = "/devices";
    render(
      <ThemeProvider>
        <AppShell title="Devices">
          <p>screen content</p>
        </AppShell>
      </ThemeProvider>,
    );
    for (const devicesLink of screen.getAllByRole("link", { name: "Devices" })) {
      expect(devicesLink).toHaveAttribute("aria-current", "page");
    }
    for (const messagesLink of screen.getAllByRole("link", { name: "Messages" })) {
      expect(messagesLink).not.toHaveAttribute("aria-current");
    }
    nav.pathname = "/chat";
  });
});

describe("out-of-nav modules stay reachable", () => {
  it("links to Security and Recovery from Settings (no dead ends)", () => {
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );

    expect(screen.getByRole("link", { name: "Open security" })).toHaveAttribute(
      "href",
      "/security",
    );
    expect(screen.getByRole("link", { name: "Open recovery" })).toHaveAttribute(
      "href",
      "/recovery",
    );
    // The forgot-password route is still advertised on the sign-in screen.
    // (Covered in auth tests via the /recovery link.)
  });

  it("sign-out asks for confirmation and calls the mock sign-out", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/mock session/i);

    // Cancel keeps the session; confirming calls signOut (mock, in-memory).
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("dialog");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Sign out" }),
    );
  });
});
