/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatScreen } from "@/components/chat/ChatScreen";

const COMPOSER_LABEL = "Message Alex Mercer";

function composer() {
  return screen.getByLabelText<HTMLTextAreaElement>(COMPOSER_LABEL);
}

async function openSimulateMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Conversation demo options" }));
}

describe("chat screen", () => {
  it("shows a loading skeleton, then the seeded history with date separators", async () => {
    render(<ChatScreen />);

    expect(screen.getByRole("status", { name: "Loading messages" })).toBeInTheDocument();

    await screen.findByText("Morning! Did the prototype build go through?");
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    // Simulated-attachment disclosure is visible in the composer.
    expect(screen.getByText(/Simulated attachments/)).toBeInTheDocument();
  });

  it("sends on Enter and walks sending → sent → delivered, then gets a mock reply", async () => {
    const user = userEvent.setup();
    render(<ChatScreen />);
    await screen.findByText("Morning! Did the prototype build go through?");

    await user.click(composer());
    await user.keyboard("See you at six{Enter}");

    // New bubble appears with the "sending" receipt state…
    await screen.findByText("See you at six");
    await screen.findByText("Sending");
    // …and advances through the mock ladder.
    await screen.findByText("Sent", {}, { timeout: 2500 });
    await screen.findByText("Delivered", {}, { timeout: 3000 });

    // The simulated partner types, then replies with a canned message.
    await screen.findByText("Alex Mercer is typing…", {}, { timeout: 4000 });
    await screen.findByText("Got it — I'll take a look tonight.", {}, { timeout: 4000 });

    // Composer was cleared after sending.
    expect(composer().value).toBe("");
  });

  it("Shift+Enter inserts a newline instead of sending", async () => {
    const user = userEvent.setup();
    render(<ChatScreen />);
    await screen.findByText("Morning! Did the prototype build go through?");

    await user.click(composer());
    await user.keyboard("one moment");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(
      screen.queryByText("one moment", { ignore: "textarea" }),
    ).not.toBeInTheDocument();
    expect(composer().value.startsWith("one moment")).toBe(true);

    await user.keyboard("{Enter}");
    await screen.findByText("one moment");
  });

  it("switches between simulated loading, error (with retry), and empty states", async () => {
    const user = userEvent.setup();
    render(<ChatScreen />);
    await screen.findByText("Morning! Did the prototype build go through?");

    // Loading
    await openSimulateMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Show loading state" }));
    expect(screen.getByRole("status", { name: "Loading messages" })).toBeInTheDocument();

    // Error + retry returns to the conversation
    await openSimulateMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Show error state" }));
    await screen.findByText("Couldn’t load messages");
    expect(screen.getByText(/simulated error state/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(
      () => expect(screen.queryByText("Couldn’t load messages")).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    await screen.findByText("Morning! Did the prototype build go through?");

    // Empty
    await openSimulateMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Show empty state" }));
    await screen.findByText("No messages yet");
    expect(screen.getByText(/replies here are simulated mock data/)).toBeInTheDocument();
  });
});
