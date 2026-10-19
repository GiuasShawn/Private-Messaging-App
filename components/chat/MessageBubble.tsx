import type { ChatMessage } from "@/lib/mock/types";
import styles from "./chat.module.css";
import { formatBytes, formatTime } from "@/lib/ui/chat";
import { FileIcon } from "@/components/ui/icons";
import { DeliveryStatus } from "./DeliveryStatus";

export interface MessageBubbleProps {
  message: ChatMessage;
  /** Whether this message starts a run of consecutive same-author messages. */
  isFirstInGroup: boolean;
  /** Whether the timestamp/receipt row is shown after this bubble. */
  isLastInGroup: boolean;
}

/**
 * A single message bubble in the design's grouped style: incoming bubbles
 * sit on `surface-2`, outgoing bubbles carry the violet-tinted border, and
 * only the last bubble of a consecutive run shows the timestamp (plus the
 * simulated receipt state for outgoing messages).
 */
export function MessageBubble({
  message,
  isFirstInGroup,
  isLastInGroup,
}: MessageBubbleProps) {
  const mine = message.author === "me";
  return (
    <div
      className={
        mine ? `${styles.row} ${styles.rowMine}` : styles.row
      }
    >
      <div
        className={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          isFirstInGroup ? (mine ? styles.bubbleMineFirst : styles.bubbleTheirsFirst) : "",
          isLastInGroup ? (mine ? styles.bubbleMineTail : styles.bubbleTheirsTail) : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="article"
        aria-label={mine ? "You said" : "Received message"}
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
      </div>
      {isLastInGroup ? (
        <div className={mine ? `${styles.meta} ${styles.metaMine}` : styles.meta}>
          <time dateTime={new Date(message.sentAt).toISOString()}>
            {formatTime(message.sentAt)}
          </time>
          {mine ? <DeliveryStatus status={message.status} /> : null}
        </div>
      ) : null}
    </div>
  );
}
