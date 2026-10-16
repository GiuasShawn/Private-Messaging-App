/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecoveryScreen } from "@/components/recovery/RecoveryScreen";

describe("recovery screen (simulated)", () => {
  it("explains that the recovery secret is separate from the password", () => {
    render(<RecoveryScreen />);
    expect(
      screen.getByText(/recovery secret will be separate from your password/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/If you lose your secret/i)).toBeInTheDocument();
  });

  it("contains no input fields — the prototype never asks for a real secret", () => {
    const { container } = render(<RecoveryScreen />);
    expect(container.querySelector("input, textarea")).toBeNull();
  });

  it("runs the simulated backup setup flow and confirms nothing was generated", async () => {
    const user = userEvent.setup();
    render(<RecoveryScreen />);

    await user.click(
      screen.getByRole("button", { name: "Set up recovery (simulated)" }),
    );
    expect(screen.getByText(/Setting up recovery/)).toBeInTheDocument();

    await screen.findByText("Backup set up (simulated)", {}, { timeout: 4000 });
    expect(
      screen.getByText(/generated no secret and stored nothing/),
    ).toBeInTheDocument();
  });

  it("runs the simulated restore flow with an explicit no-op result", async () => {
    const user = userEvent.setup();
    render(<RecoveryScreen />);

    await user.click(
      screen.getByRole("button", { name: "Restore from backup (simulated)" }),
    );
    expect(screen.getByText(/Restoring from backup/)).toBeInTheDocument();

    await screen.findByText("Restore complete (simulated)", {}, { timeout: 4000 });
    expect(screen.getByText(/No backup was read and no data changed/)).toBeInTheDocument();
  });

  it("states that Phase 1 generates nothing", () => {
    render(<RecoveryScreen />);
    expect(screen.getByText("Nothing is generated in Phase 1")).toBeInTheDocument();
  });
});
