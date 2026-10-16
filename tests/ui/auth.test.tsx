/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { MockAuthProvider } from "@/lib/ui/auth";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function renderLogin() {
  return render(
    <MockAuthProvider>
      <LoginScreen />
    </MockAuthProvider>,
  );
}

describe("mock sign-in screen", () => {
  it("shows field validation errors for an invalid email and short password", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(
      screen.getByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("toggles password visibility without disturbing typing", async () => {
    const user = userEvent.setup();
    renderLogin();

    const passwordInput = screen.getByLabelText<HTMLInputElement>("Password");
    expect(passwordInput.type).toBe("password");

    await user.type(passwordInput, "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText<HTMLInputElement>("Password").type).toBe("text");
    expect(screen.getByLabelText("Password")).toHaveValue("hunter2hunter2");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText<HTMLInputElement>("Password").type).toBe("password");
  });

  it("accepts any valid email with an 8+ character password and redirects to /chat", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/chat"), {
      timeout: 3000,
    });
    // The typed password must not be persisted anywhere; only the harmless
    // profile-name preference may exist after first sign-in.
    for (const key of Object.keys(window.localStorage)) {
      expect(key.startsWith("messenger.ui.")).toBe(true);
      expect(window.localStorage.getItem(key)).not.toContain("hunter2hunter2");
    }
  });

  it("discloses demo mode and that nothing is stored or sent", () => {
    renderLogin();
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is stored or sent anywhere/)).toBeInTheDocument();
  });
});
