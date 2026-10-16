import type { AttachmentKind } from "@/lib/mock/types";

/**
 * Pure chat logic: formatting, date grouping, attachment validation, and the
 * simulated timings used by the mock conversation. Kept dependency-free so
 * the UI and the tests share exactly one implementation.
 */

export const CHAT_TIMINGS = {
  /** Mock history load on mount. */
  initialHistoryLoadMs: 600,
  /** Outbound message status ladder: sending → sent → delivered → read. */
  messageSentMs: 400,
  messageDeliveredMs: 1_100,
  messageReadMs: 2_200,
  /** Simulated partner: starts typing, then replies. */
  typingStartMs: 900,
  replyArrivesMs: 2_500,
  /** Simulated attachment upload progress. */
  attachmentProgressTickMs: 130,
  attachmentProgressStepPercent: 12,
} as const;

/** Simulated size cap for "uploads" (nothing is ever actually uploaded). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const SUPPORTED_FILE_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "zip",
  "doc",
  "docx",
]);

export type AttachmentValidation =
  | { ok: true; kind: AttachmentKind }
  | { ok: false; reason: string };

/**
 * Shape-only validation for simulated attachments. Unsupported or oversized
 * files are rejected before any preview is created; nothing is uploaded.
 */
export function validateAttachment(file: {
  name: string;
  size: number;
  type: string;
}): AttachmentValidation {
  if (file.size <= 0) {
    return { ok: false, reason: `“${file.name}” is empty.` };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      reason: `“${file.name}” is ${formatBytes(file.size)} — the simulated limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
    };
  }
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return { ok: true, kind: "image" };
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (SUPPORTED_FILE_EXTENSIONS.has(extension)) {
    return { ok: true, kind: "file" };
  }
  return {
    ok: false,
    reason: `“${file.name}” isn’t a supported type. Simulated support: PNG, JPEG, GIF, WebP images; PDF, TXT, MD, ZIP, DOC, DOCX files.`,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** "Today" / "Yesterday" / "Monday, June 9" for date separators. */
export function formatDayLabel(epochMs: number, now: number): string {
  if (isSameDay(epochMs, now)) return "Today";
  const oneDay = 24 * 60 * 60 * 1000;
  if (isSameDay(epochMs, now - oneDay)) return "Yesterday";
  return new Date(epochMs).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
