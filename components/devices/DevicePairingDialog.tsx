import type { ReactElement } from "react";
import styles from "./devices.module.css";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Panel";

/** Deterministic "dark cell" pattern — purely decorative, not scannable. */
function isDataCell(x: number, y: number): boolean {
  return (x * 7 + y * 13 + x * y * 3) % 5 < 2;
}

function inFinderZone(x: number, y: number): boolean {
  return (x < 7 && y < 7) || (x > 17 && y < 7) || (x < 7 && y > 17);
}

/**
 * Placeholder pairing-code illustration (NOT a functional QR code). The
 * pattern is a fixed formula — nothing is generated, encoded, or scanned.
 */
function QrPlaceholder() {
  const size = 25;
  const dataCells: ReactElement[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (inFinderZone(x, y)) continue;
      if (isDataCell(x, y)) {
        dataCells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
      }
    }
  }

  const finder = (fx: number, fy: number) => (
    <g key={`f-${fx}-${fy}`} transform={`translate(${fx} ${fy})`}>
      <rect width={7} height={7} fill="#0b0e12" />
      <rect x={1} y={1} width={5} height={5} fill="#ffffff" />
      <rect x={2} y={2} width={3} height={3} fill="#0b0e12" />
    </g>
  );

  return (
    <svg
      className={styles.qrPlaceholder}
      width={168}
      height={168}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Placeholder pairing-code illustration — not a real QR code"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <g fill="#0b0e12">{dataCells}</g>
      {finder(0, 0)}
      {finder(18, 0)}
      {finder(0, 18)}
    </svg>
  );
}

export interface DevicePairingDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Device-pairing dialog with a clearly labelled placeholder code. */
export function DevicePairingDialog({ open, onClose }: DevicePairingDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Pair a new device"
      description="Sign in on the new device and approve the connection here."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <Callout tone="warn" title="Simulated in Phase 1">
        The code below is a decorative placeholder, not a scannable QR code.
        No pairing session is created and nothing is exchanged between
        devices.
      </Callout>

      <div className={styles.qrFrame}>
        <QrPlaceholder />
        <p className={styles.pairCaption}>
          Placeholder pairing code · simulated
        </p>
      </div>

      <ol className={styles.pairSteps}>
        <li className={styles.pairStep}>
          Open Haven on the device you want to add and sign in with the same
          account (mock sign-in in this build).
        </li>
        <li className={styles.pairStep}>
          Approve the request from the pending-device card on this screen.
        </li>
        <li className={styles.pairStep}>
          In a later phase, scan a real one-time code that cryptographically
          links the two devices.
        </li>
      </ol>
    </Dialog>
  );
}
