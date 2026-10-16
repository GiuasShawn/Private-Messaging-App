import type { ChatMessage, Participant } from "@/lib/mock/types";
import styles from "./chat.module.css";
import { Avatar } from "@/components/ui/Avatar";
import { formatBytes, formatTime } from "@/lib/ui/chat";
import { FileIcon } from "@/components/ui/icons";
import { DeliveryStatus } from "./DeliveryStatus";

export interface MessageBubbleProps {
  message: ChatMessage;
  /** Conversation partner (avatar is shown on their messages). */
  partner: Participant;
}

/**
 * A single message bubble: optional attachment previews, pre-wrapped text,
 * timestamp, and — for outgoing messages — the simulated receipt state.
 */
export function MessageBubble({ message, partner }: MessageBubbleProps) {
  const mine = message.author === "me";
  return (
    <div className={mine ? `${styles.row} ${styles.rowMine}` : styles.row}>
      {!mine ? (
        <span className={styles.rowAvatar}>
          <Avatar initials={partner.initials} size="sm" label={partner.displayName} />
        </span>
      ) : null}
      <div className={mine ? `${styles.bubbleCol} ${styles.bubbleColMine}` : styles.bubbleCol}>
        <article
          className={
            mine ? `${styles.bubble} ${styles.bubbleMine}` : `${styles.bubble} ${styles.bubbleTheirs}`
          }
          aria-label={mine ? "You said" : `${partner.displayName} said`}
        >
          {message.attachments.length > 0 ? (
            <div className={styles.bubbleAttachments}>
              {message.attachments.map((attachment) =>
                attachment.kind === "image" && attachment.previewUrl ? (
                  // Local object URL preview — never uploaded anywhere;
                  // next/image cannot optimize blob: URLs.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={attachment.id}
                    className={styles.imageThumb}
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    loading="lazy"
                  />
                ) : (
                  <div key={attachment.id} className={styles.fileChip}>
                    <span className={styles.fileChipIcon} aria-hidden>
                      <FileIcon size={20} />
                    </span>
                    <span className={styles.fileChipText}>
                      <span className={styles.fileChipName}>{attachment.name}</span>
                      <span className={styles.fileChipMeta}>
                        {formatBytes(attachment.sizeBytes)} · simulated upload
                      </span>
                    </span>
                  </div>
                ),
              )}
            </div>
          ) : null}
          {message.text ? <span className={styles.bubbleText}>{message.text}</span> : null}
        </article>
        <div className={styles.meta}>
          <time dateTime={new Date(message.sentAt).toISOString()}>
            {formatTime(message.sentAt)}
          </time>
          {mine ? <DeliveryStatus status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
}
