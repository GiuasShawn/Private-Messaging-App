"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import styles from "./settings.module.css";
import { Panel, SettingsRow } from "@/components/ui/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { useTheme } from "@/lib/ui/theme";
import { useMockAuth } from "@/lib/ui/auth";
import { DEFAULT_LOCAL_PREFS, initialsFor, useLocalUiPrefs } from "@/lib/ui/prefs";
import type { ThemePreference } from "@/lib/mock/types";
import {
  BellActiveIcon,
  MoonIcon,
  PowerIcon,
  ShieldCheckIcon,
  SunIcon,
  TrashIcon,
} from "@/components/ui/icons";

const THEME_OPTIONS: readonly {
  value: ThemePreference;
  label: string;
  icon: ReactNode;
}[] = [
  { value: "dark", label: "Dark", icon: <MoonIcon size={14} /> },
  { value: "light", label: "Light", icon: <SunIcon size={14} /> },
];

/**
 * Settings screen in the design's sectioned layout (Profile / Appearance /
 * Notifications / Privacy / Account / Danger zone). Persists only harmless
 * UI preferences via the namespaced local store — never passwords, keys, or
 * recovery secrets. Sign-out is mock: it clears the in-memory user only.
 */
export function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useLocalUiPrefs();
  const { user, signOut } = useMockAuth();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const previewName = prefs.displayName.trim() || "You";
  const accountEmail = user?.email ?? "not signed in";

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.pageHead}>
          <div>
            <p className={styles.eyebrow}>Preferences</p>
            <h1 className={styles.title}>Settings</h1>
            <p className={styles.subtitle}>
              Make Haven feel like yours. Every control here writes only a
              harmless local preference on this device.
            </p>
          </div>
          <span className={styles.revisionPill}>
            <span className={styles.revisionDot} aria-hidden />
            Client revision: v2.4.9 (prototype)
          </span>
        </div>

        {/* ---------- Profile ---------- */}
        <section aria-labelledby="settings-profile-heading">
          <h2 id="settings-profile-heading" className={styles.sectionTitle}>
            Profile
          </h2>
          <p className={styles.sectionSub}>
            How you appear in this interface.
          </p>
          <Panel>
            <div className={styles.profileRow}>
              <Avatar size="lg" initials={initialsFor(previewName)} label={previewName} />
              <div className={styles.profileField}>
                <Field
                  label="Display name"
                  htmlFor="settings-display-name"
                  hint="Up to 32 characters · stored on this device only"
                >
                  <span className={styles.inputWithChip}>
                    <TextInput
                      id="settings-display-name"
                      value={prefs.displayName}
                      maxLength={32}
                      placeholder="You"
                      onChange={(event) =>
                        setPrefs({ ...prefs, displayName: event.target.value })
                      }
                    />
                    <span className={styles.peerChip} aria-hidden>
                      PEER-01
                    </span>
                  </span>
                </Field>
              </div>
              <p className={styles.saveState} role="status">
                Saved on this device
              </p>
            </div>
            <p className={styles.storageHint}>
              Preview: <strong>{previewName}</strong> · initials shown on
              avatars. Stored on this device only — there is no account server
              in Phase 1.
            </p>
            <SettingsRow
              divided
              label="Account identifier"
              description="Used strictly for the mock sign-in flow; there is no real account behind it."
              control={
                <span className={styles.identifierRow}>
                  <span className={styles.identifierValue}>{accountEmail}</span>
                  <span className={styles.mockChip}>Mock account</span>
                </span>
              }
            />
          </Panel>
        </section>

        {/* ---------- Appearance ---------- */}
        <section aria-labelledby="settings-appearance-heading">
          <h2 id="settings-appearance-heading" className={styles.sectionTitle}>
            Appearance
          </h2>
          <p className={styles.sectionSub}>
            Calibrate the chrome for low light. Dark is the default.
          </p>
          <Panel>
            <SettingsRow
              label="Theme"
              description="Your choice is remembered on this device."
              control={
                <span className={styles.themeGroup} role="group" aria-label="Theme">
                  {THEME_OPTIONS.map((option) => {
                    const active = theme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        className={
                          active
                            ? `${styles.themeOption} ${styles.themeOptionActive}`
                            : styles.themeOption
                        }
                        onClick={() => setTheme(option.value)}
                      >
                        <span aria-hidden className={styles.themeIcon}>
                          {option.icon}
                        </span>
                        {option.label}
                      </button>
                    );
                  })}
                </span>
              }
            />
          </Panel>
        </section>

        {/* ---------- Notifications ---------- */}
        <section aria-labelledby="settings-notifications-heading">
          <h2 id="settings-notifications-heading" className={styles.sectionTitle}>
            <span className={styles.sectionIcon} aria-hidden>
              <BellActiveIcon size={16} />
            </span>
            Notifications
          </h2>
          <p className={styles.sectionSub}>
            Preference controls only — this prototype delivers no
            notifications.
          </p>
          <Panel>
            <SettingsRow
              label="Notification sound"
              description="Persists your preference for a later phase."
              control={
                <Toggle
                  label="Notification sound"
                  checked={prefs.notifications.soundEnabled}
                  onChange={(next) =>
                    setPrefs({
                      ...prefs,
                      notifications: { ...prefs.notifications, soundEnabled: next },
                    })
                  }
                />
              }
            />
            <SettingsRow
              divided
              label="Message previews"
              description="Show message text in notifications when real notifications exist."
              control={
                <Toggle
                  label="Message previews"
                  checked={prefs.notifications.messagePreviewEnabled}
                  onChange={(next) =>
                    setPrefs({
                      ...prefs,
                      notifications: {
                        ...prefs.notifications,
                        messagePreviewEnabled: next,
                      },
                    })
                  }
                />
              }
            />
          </Panel>
        </section>

        {/* ---------- Privacy ---------- */}
        <section aria-labelledby="settings-privacy-heading">
          <h2 id="settings-privacy-heading" className={styles.sectionTitle}>
            <span className={styles.sectionIcon} aria-hidden>
              <ShieldCheckIcon size={16} />
            </span>
            Privacy &amp; cryptographic ephemera
          </h2>
          <p className={styles.sectionSub}>
            What this account will share once messaging is wired up in a later
            phase.
          </p>
          <Panel>
            <SettingsRow
              label="Send read receipts"
              description="Saved locally now; respected by the messaging layer in a later phase."
              control={
                <Toggle
                  label="Send read receipts from settings"
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
              description="Saved locally now; the mock chat currently ignores it."
              control={
                <Toggle
                  label="Send typing indicators from settings"
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
            <div className={styles.panelFootnote}>
              Changes apply to this device and take effect immediately.
            </div>
          </Panel>
        </section>

        {/* ---------- Account ---------- */}
        <section aria-labelledby="settings-account-heading">
          <h2 id="settings-account-heading" className={styles.sectionTitle}>
            Account
          </h2>
          <p className={styles.sectionSub}>
            The mock session lives in memory only — signing out just returns
            to the sign-in screen.
          </p>
          <Panel>
            <SettingsRow
              label="Security diagnostics"
              description="The Phase 1 security checklist module — kept reachable even though it is no longer a primary-nav destination."
              control={
                <Link href="/security" className={styles.moduleLink}>
                  Open security
                </Link>
              }
            />
            <SettingsRow
              divided
              label="Recovery kit"
              description="The simulated recovery-key walkthrough behind the sign-in screen's “Forgot password?” link."
              control={
                <Link href="/recovery" className={styles.moduleLink}>
                  Open recovery
                </Link>
              }
            />
            <SettingsRow
              divided
              label="Local data"
              description="Keys used: messenger.ui.theme and messenger.ui.prefs. Passwords, private keys, and recovery secrets are never written anywhere."
              control={
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setPrefs({ ...DEFAULT_LOCAL_PREFS })}
                >
                  Reset local preferences
                </Button>
              }
            />
            <SettingsRow
              divided
              label="Sign out of session"
              description="Ends the in-memory mock session. Stored UI preferences remain on this device."
              control={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<PowerIcon size={14} />}
                  onClick={() => setSignOutOpen(true)}
                >
                  Sign out
                </Button>
              }
            />
          </Panel>
        </section>

        {/* ---------- Danger zone ---------- */}
        <section aria-labelledby="settings-danger-heading">
          <h2 id="settings-danger-heading" className={`${styles.sectionTitle} ${styles.dangerTitle}`}>
            <span className={styles.sectionIcon} aria-hidden>
              <TrashIcon size={16} />
            </span>
            Danger zone
          </h2>
          <p className={styles.sectionSub}>
            There is no real account or identity record in this prototype —
            the only data that exists is the local preferences above.
          </p>
          <div className={styles.dangerCard}>
            <div>
              <p className={styles.dangerCardTitle}>Delete local prototype data</p>
              <p className={styles.dangerCardDesc}>
                Clears every messenger.ui.* preference stored by this browser.
                Nothing else exists to delete.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setPrefs({ ...DEFAULT_LOCAL_PREFS })}
            >
              Delete local data
            </Button>
          </div>
        </section>

        <p className={styles.footerLine}>
          Haven prototype · strict local-only architecture · no server, no
          telemetry, no account backend
        </p>
      </div>

      <Dialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out of this session?"
        description="The mock session only lives in memory — signing out returns you to the sign-in screen. Your local UI preferences stay on this device."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSignOutOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={signOut}>
              Sign out
            </Button>
          </>
        }
      >
        <p>
          Nothing is sent anywhere: there is no server session to end in this
          prototype.
        </p>
      </Dialog>
    </div>
  );
}
