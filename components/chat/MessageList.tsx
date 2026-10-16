"use client";

import { useEffect, useRef } from "react";
import styles from "./chat.module.css";
import type {
  AsyncUiState,
  ChatMessage,
  Participant,
} from "@/lib/mock/types";
import { formatDayLabel, isSameDay } from "@/lib/ui/chat";
import { EmptyState } from "@/components/ui/Tooltip";
import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon, MessageIcon, RefreshIcon } from "@/components/ui/icons";
import { MessageBubble } from "./MessageBubble";
import { DateSeparator } from "./DateSeparator";
import { TypingIndicator } from "./TypingIndicator";

export interface MessageListProps {
  messages: readonly ChatMessage[];
  partner: Participant;
  state: AsyncUiState;
  themTyping: boolean;
  /** Fixed "now" for stable Today/Yesterday separators within a render pass. */
  now: number;
  onRetry: () => void;
}

/**
 * Scrollable message history. Handles the three required history states
 * (loading skeleton / inline error / empty) and keeps the view pinned to the
 * newest message. The list is a log landmark so new content is announced.
 */
export function MessageList({
  messages,
  partner,
  state,
  themTyping,
  now,
  onRetry,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pin to the newest message when content changes (no state is set here).
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, themTyping, state]);

  if (state === "loading") {
    return (
      <div className={styles.list} role="status" aria-label="Loading messages">
        <span className="sr-only">Loading messages…</span>
        <div className={styles.skeletonBubble} aria-hidden />
        <div className={`${styles.skeletonBubble} ${styles.skeletonMine}`} aria-hidden />
        <div className={styles.skeletonBubble} aria-hidden />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={styles.list}>
        <div className={styles.historyError} role="alert">
          <p className={styles.historyErrorTitle}>
            <AlertTriangleIcon size={18} />
            Couldn’t load messages
          </p>
          <p className={styles.historyErrorDesc}>
            This is a simulated error state for interface review — no request
            was made and no data was lost.
          </p>
          <Button
            variant="secondary"
            icon={<RefreshIcon size={16} />}
            onClick={onRetry}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={styles.list}>
        <EmptyState
          icon={<MessageIcon size={22} />}
          title="No messages yet"
          description={`Say hello to ${partner.displayName} — replies here are simulated mock data.`}
        />
      </div>
    );
  }

  return (
    <div className={styles.list} role="log" aria-label="Messages" aria-live="polite">
      {messages.map((message, index) => {
        const previous = index > 0 ? messages[index - 1] : undefined;
        const showSeparator = !previous || !isSameDay(previous.sentAt, message.sentAt);
        return (
          <div key={message.id}>
            {showSeparator ? (
              <DateSeparator label={formatDayLabel(message.sentAt, now)} />
            ) : null}
            <MessageBubble message={message} partner={partner} />
          </div>
        );
      })}
      {themTyping ? <TypingIndicator name={partner.displayName} /> : null}
    </div>
  );
}
