"use client";

import { useEffect, useState } from "react";
import styles from "./recovery.module.css";
import { Callout, Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { CheckIcon, LifeBuoyIcon, RefreshIcon } from "@/components/ui/icons";

const CREATE_STEPS = [
  "Confirming account context (simulated)",
  "Deriving a backup key (simulated — no key is created)",
  "Sealing the mock backup (simulated)",
] as const;

const RESTORE_STEPS = [
  "Locating your backup (simulated)",
  "Checking the recovery secret (simulated)",
  "Restoring history (simulated)",
] as const;

const STEP_MS = 420;

type Flow = "create" | "restore";
type Result = "created" | "restored";

/**
 * Recovery screen — fully simulated. No recovery secret is generated, shown,
 * entered, or stored anywhere: the flow is button-driven on purpose so a
 * prototype can never mishandle a real secret. Copy explains the design
 * (secret ≠ password) and the consequences of losing the future secret.
 */
export function RecoveryScreen() {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  // Drive the simulated progress; every timer is cancelled on unmount.
  useEffect(() => {
    if (!flow) return;
    const timers: number[] = [];
    const steps = flow === "create" ? CREATE_STEPS : RESTORE_STEPS;
    steps.forEach((_, index) => {
      if (index === 0) return;
      timers.push(
        window.setTimeout(() => setStep(index), index * STEP_MS),
      );
    });
    timers.push(
      window.setTimeout(
        () => {
          setResult(flow === "create" ? "created" : "restored");
          setFlow(null);
          setStep(0);
        },
        steps.length * STEP_MS,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [flow]);

  const steps = flow === "create" ? CREATE_STEPS : RESTORE_STEPS;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div>
          <h1 className={styles.title}>Recovery</h1>
          <p className={styles.subtitle}>
            How you will regain access if you lose your devices — and why the
            recovery secret is deliberately different from your password.
          </p>
        </div>

        <Callout tone="warn" title="Your recovery secret will be separate from your password">
          Your account password signs you in; the recovery secret restores your
          encrypted history on a new device. They are two different things on
          purpose. If you lose the recovery secret, no one — including a future
          operator of this service — can restore your history for you.
        </Callout>

        {result === "created" ? (
          <div className={styles.resultBox} role="status">
            <span className={styles.resultIcon} aria-hidden>
              <CheckIcon size={24} />
            </span>
            <p className={styles.resultTitle}>Backup set up (simulated)</p>
            <p className={styles.resultDesc}>
              In a later phase you will be shown a recovery secret exactly
              once, with instructions to store it offline. This prototype
              generated no secret and stored nothing.
            </p>
            <Button variant="secondary" onClick={() => setResult(null)}>
              Done
            </Button>
          </div>
        ) : null}

        {result === "restored" ? (
          <div className={styles.resultBox} role="status">
            <span className={styles.resultIcon} aria-hidden>
              <RefreshIcon size={22} />
            </span>
            <p className={styles.resultTitle}>Restore complete (simulated)</p>
            <p className={styles.resultDesc}>
              No backup was read and no data changed — this was a walkthrough
              of the interface only. The real flow will validate your recovery
              secret before anything is restored.
            </p>
            <Button variant="secondary" onClick={() => setResult(null)}>
              Done
            </Button>
          </div>
        ) : null}

        {flow ? (
          <div className={styles.flowBox} aria-live="polite">
            <p className={styles.flowHeading}>
              <Spinner size={16} />
              {flow === "create"
                ? "Setting up recovery (simulated)…"
                : "Restoring from backup (simulated)…"}
            </p>
            <ol className={styles.stepList}>
              {steps.map((label, index) => {
                const state =
                  index < step ? "done" : index === step ? "active" : "pending";
                return (
                  <li
                    key={label}
                    className={
                      state === "done"
                        ? `${styles.step} ${styles.stepDone}`
                        : state === "active"
                          ? `${styles.step} ${styles.stepActive}`
                          : styles.step
                    }
                  >
                    <span className={styles.stepDot} aria-hidden>
                      {state === "done" ? <CheckIcon size={13} /> : index + 1}
                    </span>
                    {label}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        {!flow && !result ? (
          <Panel
            title="Recovery backup"
            description="Create a backup you can restore from a new device."
            action={<StatusBadge tone="neutral">Not set up</StatusBadge>}
          >
            <Callout tone="info" title="Nothing is generated in Phase 1">
              The buttons below walk through the future backup and restore
              flows. No recovery secret is created, requested, or stored — by
              design, so a prototype cannot mishandle one.
            </Callout>
            <div className={styles.flowActions}>
              <Button onClick={() => setFlow("create")}>
                Set up recovery (simulated)
              </Button>
              <Button
                variant="secondary"
                icon={<LifeBuoyIcon size={16} />}
                onClick={() => setFlow("restore")}
              >
                Restore from backup (simulated)
              </Button>
            </div>
          </Panel>
        ) : null}

        {result && !flow ? (
          <Panel
            title="Recovery backup"
            description="Status updates are cosmetic in Phase 1."
            action={
              <StatusBadge tone="accent">Set up (simulated)</StatusBadge>
            }
          >
            <div className={styles.flowActions}>
              <Button variant="secondary" onClick={() => setFlow("create")}>
                Run setup again
              </Button>
              <Button variant="secondary" onClick={() => setFlow("restore")}>
                Run restore again
              </Button>
            </div>
          </Panel>
        ) : null}

        <Panel title="If you lose your secret">
          <Callout tone="warn" title="There is no reset path">
            Recovery secrets cannot be reset or emailed to you — that is what
            keeps your history unreadable to anyone else. In a later phase you
            will be prompted to record the secret offline when you set it up.
            Until then, there is nothing to lose in this prototype.
          </Callout>
        </Panel>
      </div>
    </div>
  );
}
