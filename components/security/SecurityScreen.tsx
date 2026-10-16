"use client";

import Link from "next/link";
import styles from "./security.module.css";
import { Callout, Panel, SettingsRow } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/Avatar";
import { Toggle } from "@/components/ui/Toggle";
import { useLocalUiPrefs } from "@/lib/ui/prefs";

/**
 * Security settings. Copy deliberately separates what Phase 0.5 proved (the
 * crypto spike) from what this build actually does (nothing cryptographic in
 * the messaging UI) so the screen never implies production E2EE or recovery.
 */
export function SecurityScreen() {
  const [prefs, setPrefs] = useLocalUiPrefs();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div>
          <h1 className={styles.title}>Security</h1>
          <p className={styles.subtitle}>
            Encryption, verification, recovery, and privacy controls. This
            screen states plainly what is implemented versus planned.
          </p>
        </div>

        <Panel
          title="Encryption status"
          description="Where end-to-end encryption stands in this build."
          action={<StatusBadge tone="warn">Not wired into messaging</StatusBadge>}
        >
          <Callout tone="info" title="Proven in Phase 0.5, not connected here">
            The feasibility spike proved browser cryptography end-to-end —
            17 automated tests across Chromium, Firefox, and WebKit (open{" "}
            <Link href="/spike">/spike</Link>). This Phase 1 interface does not
            encrypt, transmit, or store messages: the chat is local mock data.
            Wiring real E2EE into messaging is scheduled for a later phase.
          </Callout>
          <SettingsRow
            label="Protocol (spike)"
            description="Matrix Olm + Megolm via vodozemac — evaluated in Phase 0.5, not yet used by this UI."
            control={<StatusBadge tone="neutral">Spike only</StatusBadge>}
          />
          <SettingsRow
            divided
            label="Key storage (spike)"
            description="Encrypted-at-rest sessions were demonstrated in IndexedDB; production key storage is not implemented."
            control={<StatusBadge tone="neutral">Spike only</StatusBadge>}
          />
        </Panel>

        <Panel
          title="Device verification"
          description="No device or conversation has completed a cryptographic identity check in this build."
        >
          <SettingsRow
            label="Your devices"
            description="Review registered devices, approvals, and their simulated verification labels."
            control={<Link className={styles.linkBtn} href="/devices">Review devices</Link>}
          />
          <SettingsRow
            divided
            label="Conversation with Alex"
            description="Safety-number verification arrives in a later phase."
            control={<StatusBadge tone="neutral">Not verified</StatusBadge>}
          />
        </Panel>

        <Panel
          title="Recovery & backup"
          description="Recovery is separate from your account password by design."
        >
          <SettingsRow
            label="Recovery secret"
            description="Not set up. The setup flow here is simulated and generates no secret."
            control={<Link className={styles.linkBtn} href="/recovery">Open recovery</Link>}
          />
        </Panel>

        <Panel
          title="Sessions & privacy"
          description="Preferences below are stored in this browser only."
        >
          <SettingsRow
            label="Send read receipts"
            description="Stored as a local UI preference; Phase 1 mock receipts are unaffected. Later phases will honor it."
            control={
              <Toggle
                label="Send read receipts"
                checked={prefs.privacy.sendReadReceipts}
                onChange={(next) =>
                  setPrefs({
                    ...prefs,
                    privacy: { ...prefs.privacy, sendReadReceipts: next },
                  })
                }
              />
            }
          />
          <SettingsRow
            divided
            label="Send typing indicators"
            description="Local preference only; the mock typing indicator behaves the same either way."
            control={
              <Toggle
                label="Send typing indicators"
                checked={prefs.privacy.typingIndicators}
                onChange={(next) =>
                  setPrefs({
                    ...prefs,
                    privacy: { ...prefs.privacy, typingIndicators: next },
                  })
                }
              />
            }
          />
          <SettingsRow
            divided
            label="Browser sessions"
            description="Phase 1 has no real sessions — device entries are mock data."
            control={<Link className={styles.linkBtn} href="/devices">Manage devices</Link>}
          />
          <Callout tone="warn" title="What this browser stores">
            Only harmless UI preferences (theme, display name, notification and
            privacy toggles) are saved locally. This build never stores
            passwords, private keys, or recovery secrets — and it never will.
          </Callout>
        </Panel>
      </div>
    </div>
  );
}
