/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProviders } from "@/components/AppProviders";
import { useMockAuth } from "@/lib/ui/auth";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { DevicesScreen } from "@/components/devices/DevicesScreen";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/chat",
}));

const TEST_PASSWORD = "correct-horse-battery";

/**
 * Renders the signed-out login first, then the main screens once the mock
 * sign-in succeeds — all with the REAL mock-auth implementation (not faked),
 * so the storage audit below is meaningful.
 */
function Harness() {
  const { user } = useMockAuth();
  if (!user) return <LoginScreen />;
  return (
    <div>
      <ChatScreen />
      <DevicesScreen />
      <SettingsScreen />
    </div>
  );
}

describe("no network or secret leakage in the UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.setAttribute("data-theme", "dark");
  });

  it("performs a full signed-in interaction pass without any network call or secret storage", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const beaconSpy = vi.fn();
    vi.stubGlobal("sendBeacon", beaconSpy);

    render(
      <AppProviders>
        <Harness />
      </AppProviders>,
    );

    // --- Sign in through the real mock-auth path ---
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), TEST_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Morning! Did the prototype build go through?", {}, { timeout: 4000 });

    // --- Interact: send a message ---
    const textarea = screen.getByLabelText("Message Alex Mercer");
    await user.click(textarea);
    await user.keyboard("Leak check message{Enter}");
    await screen.findByText("Leak check message");

    // --- Interact: stage + reject an attachment ---
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const bad = new File(["x"], "tool.exe", { type: "application/x-msdownload" });
    fireEvent.change(fileInput as HTMLElement, { target: { files: [bad] } });
    await screen.findByText(/tool\.exe/);

    // --- Interact: approve a device ---
    await user.click(screen.getByRole("button", { name: "Approve" }));

    // --- Interact: toggle a settings switch (persists a harmless pref) ---
    await user.click(screen.getByRole("switch", { name: "Notification sound" }));

    // --- Audit: nothing was transmitted ---
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();

    // --- Audit: only namespaced UI-preference keys exist, and no secret is stored ---
    const keys = Object.keys(window.localStorage);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key.startsWith("messenger.ui.")).toBe(true);
      expect(window.localStorage.getItem(key)).not.toContain(TEST_PASSWORD);
    }
    expect(keys).not.toContain("messenger.auth.token");

    vi.unstubAllGlobals();
  });
});
