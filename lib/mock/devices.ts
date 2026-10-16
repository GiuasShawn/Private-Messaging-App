import type { DeviceKind, RegisteredDevice } from "@/lib/mock/types";

/**
 * Mock registered devices for the Phase 1 prototype. Statuses cover the three
 * required visual states (pending / approved / revoked); verification values
 * are interface placeholders only and are labelled "simulated" in the UI —
 * no device has been cryptographically verified.
 */
export function createMockDevices(now: number): RegisteredDevice[] {
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  return [
    {
      id: "dev-phone",
      displayName: "Pixel 9",
      kind: "phone",
      platform: "Android 16",
      status: "approved",
      verification: "verified-mock",
      addedAt: now - 90 * day,
      lastActiveAt: now,
      isCurrentDevice: true,
    },
    {
      id: "dev-laptop",
      displayName: "Studio MacBook",
      kind: "desktop",
      platform: "macOS 16",
      status: "approved",
      verification: "unverified",
      addedAt: now - 60 * day,
      lastActiveAt: now - 2 * hour,
      isCurrentDevice: false,
    },
    {
      id: "dev-web",
      displayName: "Firefox on Windows",
      kind: "web",
      platform: "Windows 11 · browser session",
      status: "approved",
      verification: "verification-pending",
      addedAt: now - 5 * day,
      lastActiveAt: now - 26 * minute,
      isCurrentDevice: false,
    },
    {
      id: "dev-tablet",
      displayName: "Kitchen iPad",
      kind: "tablet",
      platform: "iPadOS 19",
      status: "pending",
      verification: "unverified",
      addedAt: now - 12 * minute,
      lastActiveAt: null,
      isCurrentDevice: false,
    },
    {
      id: "dev-old-phone",
      displayName: "Old phone (retired)",
      kind: "phone",
      platform: "Android 13",
      status: "revoked",
      verification: "unverified",
      addedAt: now - 300 * day,
      lastActiveAt: now - 40 * day,
      isCurrentDevice: false,
    },
  ];
}

const DEVICE_KIND_LABEL: Record<DeviceKind, string> = {
  phone: "Phone",
  tablet: "Tablet",
  desktop: "Desktop",
  web: "Browser session",
};

export function deviceKindLabel(kind: DeviceKind): string {
  return DEVICE_KIND_LABEL[kind];
}

/** "Active now" / "2 hours ago" / "Never" for device cards. */
export function lastActiveLabel(lastActiveAt: number | null, now: number): string {
  if (lastActiveAt === null) return "Never active";
  const elapsed = now - lastActiveAt;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < 2 * minute) return "Active now";
  if (elapsed < hour) return `${Math.floor(elapsed / minute)} min ago`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)} h ago`;
  if (elapsed < 30 * day) return `${Math.floor(elapsed / day)} d ago`;
  return `${Math.floor(elapsed / (30 * day))} mo ago`;
}
