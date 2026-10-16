"use client";

import styles from "./settings.module.css";
import { Callout, Panel, SettingsRow } from "@/components/ui/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { useTheme } from "@/lib/ui/theme";
import { DEFAULT_LOCAL_PREFS, initialsFor, useLocalUiPrefs } from "@/lib/ui/prefs";
import type { ThemePreference } from "@/lib/mock/types";

const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

/**
 * General settings. Persists only harmless UI preferences (theme, display
 * name, notification/privacy toggles) via the namespaced local store; never
 * passwords, keys, or recovery secrets.
 */
export function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useLocalUiPrefs();

  const previewName = prefs.displayName.trim() || "You";

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>
            Appearance, profile, and preferences for this device. Everything
            here is stored locally in your browser.
          </p>
        </div>

        <Panel title="Appearance" description="Choose how Haven looks.">
          <SettingsRow
            label="Theme"
            description="Dark is the default. Your choice is remembered on this device."
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
                      <span
                        aria-hidden
                        className={
                          option.value === "dark"
                            ? `${styles.swatch} ${styles.swatchDark}`
                            : `${styles.swatch} ${styles.swatchLight}`
                        }
                      />
                      {option.label}
                    </button>
                  );
                })}
              </span>
            }
          />
        </Panel>

        <Panel title="Profile" description="How you appear in this interface.">
          <div className={styles.profileRow}>
            <Avatar size="lg" initials={initialsFor(previewName)} label={previewName} />
            <div className={styles.profileField}>
              <Field
                label="Display name"
                htmlFor="settings-display-name"
                hint="Up to 32 characters"
              >
                <TextInput
                  id="settings-display-name"
                  value={prefs.displayName}
                  maxLength={32}
                  placeholder="You"
                  onChange={(event) =>
                    setPrefs({ ...prefs, displayName: event.target.value })
                  }
                />
              </Field>
            </div>
          </div>
          <p className={styles.storageHint}>
            Preview: <strong>{previewName}</strong> · initials shown on
            avatars. Stored on this device only — there is no account server in
            Phase 1.
          </p>
        </Panel>

        <Panel title="Notifications" description="Preference controls only.">
          <SettingsRow
            label="Notification sound"
            description="This prototype delivers no notifications; the toggle persists your preference."
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

        <Panel title="Privacy" description="How this account will behave once wired up.">
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
        </Panel>

        <Panel
          title="Local data"
          description="What this browser remembers about your preferences."
        >
          <Callout tone="info" title="Only UI preferences are stored">
            Keys used: <code>messenger.ui.theme</code> (dark/light) and{" "}
            <code>messenger.ui.prefs</code> (display name and the toggles
            above). Passwords, private keys, and recovery secrets are never
            written anywhere — nothing in this build has access to them.
          </Callout>
          <div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setPrefs({ ...DEFAULT_LOCAL_PREFS })}
            >
              Reset local preferences
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
