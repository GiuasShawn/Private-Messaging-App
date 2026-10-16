"use client";

import { useState } from "react";
import styles from "./devices.module.css";
import type { RegisteredDevice } from "@/lib/mock/types";
import { createMockDevices } from "@/lib/mock/devices";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Callout, Panel, SettingsRow } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/Avatar";
import { PlusIcon } from "@/components/ui/icons";
import { DeviceCard } from "./DeviceCard";
import { DevicePairingDialog } from "./DevicePairingDialog";

/**
 * Device management — mock data and local state only. Approve/revoke mutate
 * this page's in-memory list; nothing is sent anywhere, no device session is
 * created or destroyed, and no verification claim is cryptographic.
 */
export function DevicesScreen() {
  const [now] = useState(() => Date.now());
  const [devices, setDevices] = useState<RegisteredDevice[]>(() =>
    createMockDevices(Date.now()),
  );
  const [pairingOpen, setPairingOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<RegisteredDevice | null>(null);

  const approve = (id: string) =>
    setDevices((prev) =>
      prev.map((device) =>
        device.id === id ? { ...device, status: "approved" } : device,
      ),
    );

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    const id = revokeTarget.id;
    setDevices((prev) =>
      prev.map((device) =>
        device.id === id ? { ...device, status: "revoked" } : device,
      ),
    );
    setRevokeTarget(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>Devices</h1>
            <p className={styles.subtitle}>
              Devices and browser sessions connected to your account. Approve
              new devices you recognize and revoke anything you don&apos;t.
            </p>
          </div>
          <Button icon={<PlusIcon size={16} />} onClick={() => setPairingOpen(true)}>
            Pair a new device
          </Button>
        </div>

        <Callout tone="info" title="Mock device data">
          Every device, status, and verification label on this screen is
          interface mockup data. Approving or revoking only changes what you
          see here — no real device session exists or is affected.
        </Callout>

        <Panel
          title="Identity verification"
          description="Whether this account's devices have completed an identity check."
        >
          <SettingsRow
            label="This account"
            description="Verification compares a short code between you and Alex. It is not available in Phase 1."
            control={<StatusBadge tone="neutral">Unverified</StatusBadge>}
          />
          <Callout tone="warn" title="No cryptographic verification has run">
            Device cards may show a simulated &ldquo;Verified&rdquo; state to
            preview the design. Treat every verification label on this screen
            as a placeholder until a later phase implements real checks.
          </Callout>
        </Panel>

        <ul className={styles.deviceGrid}>
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              now={now}
              onApprove={approve}
              onRevokeRequest={setRevokeTarget}
            />
          ))}
        </ul>
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
