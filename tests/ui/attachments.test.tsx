/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatScreen } from "@/components/chat/ChatScreen";

async function waitForHistory() {
  await screen.findByText("Morning! Did the prototype build go through?");
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input;
}

function chooseFiles(input: HTMLInputElement, files: File[]) {
  fireEvent.change(input, { target: { files } });
}

describe("simulated attachments", () => {
  it("stages an image with simulated progress, then sends it in a message", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChatScreen />);
    await waitForHistory();

    chooseFiles(fileInput(container), [
      new File(["pretend-bytes"], "sunset.png", { type: "image/png" }),
    ]);

    const item = await screen.findByText("sunset.png");
    expect(item).toBeInTheDocument();
    expect(screen.getByText(/simulated limit|ready \(simulated\)|simulating upload/)).toBeInTheDocument();

    // Progress completes to 100% (local timer only).
    await screen.findByText(/ready \(simulated\)/, {}, { timeout: 4000 });

    await user.click(screen.getByRole("button", { name: "Send message" }));
    // The sent message renders the image as a local preview (alt = file name).
    const sent = await screen.findByAltText("sunset.png");
    expect(sent).toBeInTheDocument();
    // Staged tray is cleared after send.
    expect(screen.queryByRole("progressbar", { name: /sunset\.png/ })).not.toBeInTheDocument();
  });

  it("rejects oversized and unsupported files with inline, dismissible errors", async () => {
    const { container } = render(<ChatScreen />);
    await waitForHistory();

    const oversized = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(oversized, "size", { value: 30 * 1024 * 1024 });
    const unsupported = new File(["x"], "tool.exe", { type: "application/x-msdownload" });

    chooseFiles(fileInput(container), [oversized, unsupported]);

    expect(
      await screen.findByText(/“huge\.png” is 30\.0 MB — the simulated limit is 25\.0 MB\./),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/“tool\.exe” isn’t a supported type/),
    ).toBeInTheDocument();
    // Nothing was staged for rejected files.
    expect(screen.queryByText("huge.png")).not.toBeInTheDocument();
    expect(screen.queryByText("tool.exe")).not.toBeInTheDocument();

    // Errors can be dismissed.
    const dismissButtons = screen.getAllByRole("button", {
      name: "Dismiss attachment error",
    });
    expect(dismissButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("lets a staged attachment be removed before sending", async () => {
    const { container } = render(<ChatScreen />);
    await waitForHistory();

    chooseFiles(fileInput(container), [
      new File(["pdf-bytes"], "notes.pdf", { type: "application/pdf" }),
    ]);
    await screen.findByText("notes.pdf");

    await userEvent.click(
      screen.getByRole("button", { name: "Remove notes.pdf" }),
    );
    expect(screen.queryByText("notes.pdf")).not.toBeInTheDocument();
  });

  it("keeps the attachment control clearly labelled as simulated", () => {
    const { container } = render(<ChatScreen />);
    expect(
      screen.getByRole("button", {
        name: "Add photo or file attachment (simulated)",
      }),
    ).toBeInTheDocument();
    expect(fileInput(container).accept).toContain("image/png");
    expect(screen.getByText(/never uploaded or\s+sent/i)).toBeInTheDocument();
  });
});
