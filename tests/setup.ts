// Shared test setup for both the spike (node) and UI (jsdom) suites.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest runs without injected globals, so Testing Library's automatic
// cleanup hook never registers itself. Unmount every rendered tree after
// each test to keep queries unambiguous.
afterEach(() => {
  cleanup();
});

// jsdom does not implement object URLs, which the attachment-preview flow
// uses for local previews. Provide a deterministic stub when missing; in the
// node environment Node's native implementation is left untouched.
if (typeof URL.createObjectURL !== "function") {
  let counter = 0;
  URL.createObjectURL = () => `blob:vitest-mock-${(counter += 1)}`;
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {
    // no-op in tests
  };
}
