/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DevicesScreen } from "@/components/devices/DevicesScreen";

describe("device management (mock data)", () => {
  it("lists devices with pending, approved, and revoked states", () => {
    render(<DevicesScreen />);

    expect(screen.getByText("Pixel 9")).toBeInTheDocument();
    expect(screen.getByText("Studio MacBook")).toBeInTheDocument();
    expect(screen.getByText("Kitchen iPad")).toBeInTheDocument();
    expect(screen.getByText("This device")).toBeInTheDocument();

    expect(screen.getByText("Pending approval")).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Revoked")).toBeInTheDocument();
  });

  it("approves a pending device via the mock action", async () => {
    const user = userEvent.setup();
    render(<DevicesScreen />);

    expect(screen.getByText("Pending approval")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(screen.queryByText("Pending approval")).not.toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(2);
  });

  it("revokes an approved device through a confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<DevicesScreen />);

    const card = screen.getByText("Studio MacBook").closest("li");
    expect(card).not.toBeNull();
    const revokeButton = within(card as HTMLElement).getByRole("button", {
      name: "Revoke",
    });
    await user.click(revokeButton);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Revoke Studio MacBook?");
    expect(dialog).toHaveTextContent(/simulated action/);

    await user.click(screen.getByRole("button", { name: "Revoke device" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByText("Revoked").length).toBeGreaterThanOrEqual(2);
  });

  it("opens a pairing dialog with a clearly labelled placeholder code", async () => {
    const user = userEvent.setup();
    render(<DevicesScreen />);

    await user.click(screen.getByRole("button", { name: "Pair a new device" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Pair a new device");
    expect(
      screen.getByRole("img", {
        name: "Placeholder pairing-code illustration — not a real QR code",
      }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/decorative placeholder/);

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never claims cryptographic verification", () => {
    render(<DevicesScreen />);
    expect(screen.getByText("No cryptographic verification has run")).toBeInTheDocument();
    // The "verified" label is explicitly qualified as simulated.
    expect(screen.getByText("Verified (simulated)")).toBeInTheDocument();
    expect(screen.getAllByText("Unverified").length).toBeGreaterThanOrEqual(1);
  });
});
