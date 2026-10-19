"use client";

import { useState } from "react";
import styles from "./devices.module.css";
import type { RegisteredDevice } from "@/lib/mock/types";
import { createMockDevices } from "@/lib/mock/devices";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Callout } from "@/components/ui/Panel";
import { LockIcon, PlusIcon } from "@/components/ui/icons";
import { DeviceCard } from "./DeviceCard";
import { DevicePairingDialog } from "./DevicePairingDialog";

/**
 * Device management — mock data and local state only. Approve/reject/revoke
 * mutate this page's in-memory list; nothing is sent anywhere, no device
 * session is created or destroyed, and no verification claim is
 * cryptographic.
 */
export function DevicesScreen() {
  const [now] = useState(() => Date.now());
  const [devices, setDevices] = useState<RegisteredDevice[]>(() =>
    createMockDevices(Date.now()),
  );
  const [pairingOpen, setPairingOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<RegisteredDevice | null>(null);

  const setStatus = (id: string, status: RegisteredDevice["status"]) =>
    setDevices((prev) =>
      prev.map((device) => (device.id === id ? { ...device, status } : device)),
    );

  const approve = (id: string) => setStatus(id, "approved");
  const reject = (id: string) => setStatus(id, "revoked");

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    setStatus(revokeTarget.id, "revoked");
    setRevokeTarget(null);
  };

  const approvedCount = devices.filter((d) => d.status === "approved").length;
  const pendingCount = devices.filter((d) => d.status === "pending").length;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.pageHead}>
          <div>
            <p className={styles.eyebrow}>Account security</p>
            <h1 className={styles.title}>Your devices</h1>
            <p className={styles.subtitle}>
              Review the mock sessions paired with this account. Approve new
              devices you recognize and revoke anything you don&apos;t.
            </p>
          </div>
          <Button icon={<PlusIcon size={16} />} onClick={() => setPairingOpen(true)}>
            Pair a new device
          </Button>
        </div>

        <div className={styles.statStrip}>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {approvedCount}
              <span className={`${styles.statDot} ${styles.statDotOk}`} aria-hidden />
            </span>
            <span className={styles.statLabel}>Approved devices</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {pendingCount}
              <span className={`${styles.statDot} ${styles.statDotPending}`} aria-hidden />
            </span>
            <span className={styles.statLabel}>Pending approval</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>Just now</span>
            <span className={styles.statLabel}>Last account activity</span>
          </div>
        </div>

        <Callout tone="warn" title="No cryptographic verification has run">
          Every device, status, and verification label on this screen is
          interface mockup data. Approving, rejecting, or revoking only
          changes what you see here — no real device session exists or is
          affected, and no cryptographic verification has run.
        </Callout>

        <section className={styles.listSection} aria-labelledby="devices-list-heading">
          <h2 id="devices-list-heading" className={styles.sectionTitle}>
            Registered devices
          </h2>
          <p className={styles.sectionSub}>
            Simulated sessions on your account. Verification labels are
            placeholders until a later phase.
          </p>
          <ul className={styles.deviceList}>
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                now={now}
                onApprove={approve}
                onReject={reject}
                onRevokeRequest={setRevokeTarget}
              />
            ))}
          </ul>
        </section>

        <div className={styles.footerLine}>
          <span className={styles.footerLeft}>
            <LockIcon size={12} />
            Curve25519 · Double Ratchet — protocol labels are simulated in this
            prototype
          </span>
          <span className={styles.footerRight}>Fingerprint: 8f4e..2a9c (mock)</span>
        </div>
      </div>

      <DevicePairingDialog open={pairingOpen} onClose={() => setPairingOpen(false)} />

      <Dialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title={revokeTarget ? `Revoke ${revokeTarget.displayName}?` : "Revoke device?"}
        description="The device will lose access and would need to pair again. This is a simulated action — no real session is terminated."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRevoke}>
              Revoke device
            </Button>
          </>
        }
      >
        <p>
          {revokeTarget
            ? `${revokeTarget.displayName} (${revokeTarget.platform}) will be marked as revoked in this mock list.`
            : null}
        </p>
      </Dialog>
    </div>
  );
}
