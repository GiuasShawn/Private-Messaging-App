import type { RegisteredDevice } from "@/lib/mock/types";
import styles from "./devices.module.css";
import { deviceKindLabel, lastActiveLabel } from "@/lib/mock/devices";
import { StatusBadge, type BadgeTone } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  GlobeIcon,
  MonitorIcon,
  SmartphoneIcon,
  TabletIcon,
} from "@/components/ui/icons";

const KIND_ICON = {
  phone: SmartphoneIcon,
  tablet: TabletIcon,
  desktop: MonitorIcon,
  web: GlobeIcon,
} as const;

const STATUS_BADGE: Record<
  RegisteredDevice["status"],
  { tone: BadgeTone; label: string }
> = {
  pending: { tone: "warn", label: "Pending approval" },
  approved: { tone: "success", label: "Approved" },
  revoked: { tone: "danger", label: "Revoked" },
};

/**
 * Verification wording is deliberately qualified: "verified" here is a MOCK
 * visual state, never a claim that a cryptographic check has happened.
 */
const VERIFICATION_BADGE: Record<
  RegisteredDevice["verification"],
  { tone: BadgeTone; label: string; note?: string }
> = {
  unverified: { tone: "neutral", label: "Unverified" },
  "verification-pending": { tone: "warn", label: "Check pending" },
  "verified-mock": {
    tone: "accent",
    label: "Verified (simulated)",
    note: "Simulated status — no cryptographic verification has been performed.",
  },
};

export interface DeviceCardProps {
  device: RegisteredDevice;
  /** Stable reference time captured by the screen on mount. */
  now: number;
  onApprove: (id: string) => void;
  onRevokeRequest: (device: RegisteredDevice) => void;
}

/** One registered-device card with status, verification, and mock actions. */
export function DeviceCard({ device, now, onApprove, onRevokeRequest }: DeviceCardProps) {
  const Icon = KIND_ICON[device.kind];
  const status = STATUS_BADGE[device.status];
  const verification = VERIFICATION_BADGE[device.verification];
  const addedLabel = new Date(device.addedAt).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const cardClasses = [
    styles.deviceCard,
    device.status === "pending" ? styles.deviceCardPending : null,
    device.status === "revoked" ? styles.deviceCardRevoked : null,
  ]
    .filter(Boolean)
    .join(" ");

  const verificationBadge = (
    <StatusBadge tone={verification.tone}>{verification.label}</StatusBadge>
  );

  return (
    <li className={cardClasses}>
      <div className={styles.deviceTop}>
        <span className={styles.deviceIcon} aria-hidden>
          <Icon size={22} />
        </span>
        <div className={styles.deviceInfo}>
          <span className={styles.deviceNameRow}>
            <span className={styles.deviceName}>{device.displayName}</span>
            {device.isCurrentDevice ? (
              <span className={styles.currentTag}>This device</span>
            ) : null}
          </span>
          <span className={styles.devicePlatform}>{device.platform}</span>
          <span className={styles.deviceActive}>
            {lastActiveLabel(device.lastActiveAt, now)}
          </span>
        </div>
      </div>

      <div className={styles.badgeRow}>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        {verification.note ? (
          <Tooltip text={verification.note}>{verificationBadge}</Tooltip>
        ) : (
          verificationBadge
        )}
      </div>

      <dl className={styles.deviceMetaGrid}>
        <dt className={styles.metaKey}>Type</dt>
        <dd className={styles.metaValue}>{deviceKindLabel(device.kind)}</dd>
        <dt className={styles.metaKey}>Paired</dt>
        <dd className={styles.metaValue}>{addedLabel}</dd>
      </dl>

      <div className={styles.deviceActions}>
        {device.status === "pending" ? (
          <Button size="sm" onClick={() => onApprove(device.id)}>
            Approve
          </Button>
        ) : null}
        {device.status === "approved" && !device.isCurrentDevice ? (
          <Button variant="danger" size="sm" onClick={() => onRevokeRequest(device)}>
            Revoke
          </Button>
        ) : null}
      </div>
    </li>
  );
}
