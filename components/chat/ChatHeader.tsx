"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./chat.module.css";
import type { Participant, PresenceState } from "@/lib/mock/types";
import { Avatar } from "@/components/ui/Avatar";
import { EllipsisIcon } from "@/components/ui/icons";

export type HistoryStateChoice = "ready" | "loading" | "error" | "empty";

export interface ChatHeaderProps {
  partner: Participant;
  presence: PresenceState;
  onSelectHistoryState: (choice: HistoryStateChoice) => void;
}

/**
 * Conversation header: avatar, display name, connection status, and a demo
 * menu that switches the history between its mock loading/error/empty/ready
 * states for interface review. The menu is a real disclosure button
 * (aria-expanded) and closes on Escape or outside click.
 */
export function ChatHeader({
  partner,
  presence,
  onSelectHistoryState,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const statusText =
    presence === "typing"
      ? "typing…"
      : presence === "online"
        ? "Online"
        : "Last seen recently";

  return (
    <header className={styles.header}>
      <Avatar
        initials={partner.initials}
        size="md"
        presence={presence === "offline" ? "offline" : "online"}
        label={partner.displayName}
      />
      <div className={styles.headerText}>
        <h1 className={styles.partnerName}>{partner.displayName}</h1>
        <span
          className={
            presence === "typing"
              ? `${styles.presence} ${styles.presenceTyping}`
              : presence === "online"
                ? `${styles.presence} ${styles.presenceOnline}`
                : styles.presence
          }
          aria-live="polite"
        >
          {statusText}
        </span>
      </div>

      <div className={styles.menuWrap} ref={wrapRef}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.menuTrigger}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Conversation demo options"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <EllipsisIcon size={18} />
        </button>
        {menuOpen ? (
          <div className={styles.menu} role="menu" aria-label="Simulated history states">
            <p className={styles.menuNote}>
              Demo controls — switch the mock history between its interface
              states. Nothing is requested from a server.
            </p>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                onSelectHistoryState("ready");
                setMenuOpen(false);
              }}
            >
              Show conversation
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                onSelectHistoryState("loading");
                setMenuOpen(false);
              }}
            >
              Show loading state
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                onSelectHistoryState("error");
                setMenuOpen(false);
              }}
            >
              Show error state
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                onSelectHistoryState("empty");
                setMenuOpen(false);
              }}
            >
              Show empty state
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
