import type { ChatMessage, Participant } from "@/lib/mock/types";

/** The other person in this two-person messenger (mock). */
export const MOCK_PARTNER: Participant = {
  id: "alex",
  displayName: "Alex Mercer",
  initials: "AM",
  presence: "online",
};

/** Canned replies used by the simulated partner. Deterministic by index. */
export const CANNED_REPLIES: readonly string[] = [
  "Got it — I'll take a look tonight.",
  "Sounds good to me.",
  "Ha, exactly what I was thinking.",
  "Perfect. Let's leave it there for now.",
  "Thanks for the update!",
  "Nice. Talk soon?",
];

/**
 * Initial mock history. Timestamps are relative to `now` so date separators
 * (Today / Yesterday) are stable in tests and realistic in the browser.
 */
export function createInitialMessages(now: number): ChatMessage[] {
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  return [
    {
      id: "seed-1",
      author: "them",
      text: "Morning! Did the prototype build go through?",
      sentAt: now - day - 3 * hour,
      status: "read",
      attachments: [],
    },
    {
      id: "seed-2",
      author: "me",
      text: "It did — the crypto spike passed in every browser we tested.",
      sentAt: now - day - 3 * hour + 4 * minute,
      status: "read",
      attachments: [],
    },
    {
      id: "seed-3",
      author: "them",
      text: "That's a relief. What's left before we start the real UI?",
      sentAt: now - day - 2 * hour,
      status: "read",
      attachments: [],
    },
    {
      id: "seed-4",
      author: "me",
      text: "Just the interface work — mock data only, no wiring yet.",
      sentAt: now - day - 2 * hour + 3 * minute,
      status: "read",
      attachments: [],
    },
    {
      id: "seed-5",
      author: "them",
      text: "Perfect. Ping me when there's something to click through.",
      sentAt: now - 45 * minute,
      status: "read",
      attachments: [],
    },
  ];
}
