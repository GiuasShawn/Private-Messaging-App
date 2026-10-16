import styles from "./chat.module.css";
import type { Attachment } from "@/lib/mock/types";
import { formatBytes } from "@/lib/ui/chat";
import { FileIcon, ImageIcon, XIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/Button";

export interface AttachmentTrayProps {
  staged: readonly Attachment[];
  onRemove: (id: string) => void;
}

/**
 * Staged attachments waiting to be sent. Progress bars visualize the
 * SIMULATED upload (local timer only — no bytes leave the device); each item
 * can be removed before sending.
 */
export function AttachmentTray({ staged, onRemove }: AttachmentTrayProps) {
  if (staged.length === 0) return null;
  return (
    <ul className={styles.attachList} aria-label="Attachments ready to send">
      {staged.map((attachment) => (
        <li key={attachment.id} className={styles.attachCard}>
          {attachment.kind === "image" && attachment.previewUrl ? (
            // Local blob: preview — next/image cannot optimize object URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.attachThumb}
              src={attachment.previewUrl}
              alt=""
              aria-hidden
            />
          ) : (
            <span className={styles.attachIcon} aria-hidden>
              {attachment.kind === "image" ? <ImageIcon size={22} /> : <FileIcon size={22} />}
            </span>
          )}
          <span className={styles.attachText}>
            <span className={styles.attachName}>{attachment.name}</span>
            <span className={styles.attachMeta}>
              {formatBytes(attachment.sizeBytes)} ·{" "}
              {attachment.progress < 100
                ? `simulating upload ${attachment.progress}%`
                : "ready (simulated)"}
            </span>
            <span
              className={styles.attachProgressTrack}
              role="progressbar"
              aria-label={`Simulated upload progress for ${attachment.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={attachment.progress}
            >
              <span
                className={styles.attachProgressBar}
                style={{ width: `${attachment.progress}%` }}
              />
            </span>
          </span>
          <IconButton
            label={`Remove ${attachment.name}`}
            onClick={() => onRemove(attachment.id)}
          >
            <XIcon size={15} />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}
