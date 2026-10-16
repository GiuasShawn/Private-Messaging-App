/**
 * Strict UI-only types for the Phase 1 prototype.
 *
 * Everything here describes MOCK data used exclusively for interface
 * development. Nothing in this directory talks to a network, a database, a
 * cryptographic library, or a real account system. Phase 2+ may introduce
 * service modules with their own types; these keep the UI decoupled from that
 * future work.
 */

export type ThemePreference = "dark" | "light";

/** Epoch milliseconds — numbers keep mock data serializable and tests stable. */
export type EpochMs = number;

// ---------------------------------------------------------------------------
// People & conversation
// ---------------------------------------------------------------------------

export interface Participant {
  readonly id: string;
  readonly displayName: string;
  readonly initials: string;
  readonly presence: "online" | "offline";
  /** Only meaningful when presence === "offline". */
  readonly lastSeenAt?: EpochMs;
}

export type MessageAuthor = "me" | "them";

/** Simulated transmission lifecycle. "read" is driven by a mock timer. */
export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export type AttachmentKind = "image" | "file";

/**
 * A staged or sent attachment. `previewUrl` is a local object URL created in
 * the browser for images; it is never uploaded anywhere. `simulated` is
 * always true in Phase 1 and is surfaced in the UI so the prototype never
 * implies real uploads happen.
 */
export interface Attachment {
  readonly id: string;
  readonly name: string;
  readonly kind: AttachmentKind;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly previewUrl?: string;
  /** 0–100; simulated upload progress for staged attachments. */
  progress: number;
  readonly simulated: true;
}

export interface ChatMessage {
  readonly id: string;
  readonly author: MessageAuthor;
  readonly text: string;
  readonly sentAt: EpochMs;
  readonly status: MessageStatus;
  readonly attachments: readonly Attachment[];
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export type DeviceKind = "phone" | "tablet" | "desktop" | "web";

export type DeviceStatus = "pending" | "approved" | "revoked";

/**
 * Honest verification wording: in Phase 1 no device is ever cryptographically
 * verified. "verified" exists only as a MOCK state to render the intended
 * visual design, and the UI labels it as simulated.
 */
export type VerificationState = "unverified" | "verification-pending" | "verified-mock";

export interface RegisteredDevice {
  readonly id: string;
  readonly displayName: string;
  readonly kind: DeviceKind;
  readonly platform: string;
  readonly status: DeviceStatus;
  readonly verification: VerificationState;
  readonly addedAt: EpochMs;
  /** EpochMs of last activity, or null when never seen. */
  readonly lastActiveAt: EpochMs | null;
  readonly isCurrentDevice: boolean;
}

// ---------------------------------------------------------------------------
// Preferences & mock account
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  readonly soundEnabled: boolean;
  readonly messagePreviewEnabled: boolean;
}

export interface PrivacyPreferences {
  readonly sendReadReceipts: boolean;
  readonly typingIndicators: boolean;
}

/** Only harmless UI preferences are persisted (localStorage, namespaced). */
export interface UiPreferences {
  readonly theme: ThemePreference;
  readonly notifications: NotificationPreferences;
  readonly privacy: PrivacyPreferences;
}

/** Mock signed-in identity. Held in memory only; never persisted. */
export interface MockUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly initials: string;
}

/** Simulated connection state shown in the conversation header. */
export type PresenceState = "online" | "offline" | "typing";

/** Loading lifecycle for async-looking mock screens. */
export type AsyncUiState = "loading" | "ready" | "error";
