"use client";

import {
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import styles from "./chat.module.css";
import type { Attachment } from "@/lib/mock/types";
import { IconButton } from "@/components/ui/Button";
import { AlertTriangleIcon, PaperclipIcon, SendIcon, XIcon } from "@/components/ui/icons";
import { AttachmentTray } from "./AttachmentTray";

export interface MessageComposerProps {
  partnerName: string;
  value: string;
  onValueChange: (next: string) => void;
  onSend: () => void;
  onFilesChosen: (files: FileList) => void;
  staged: readonly Attachment[];
  onRemoveStaged: (id: string) => void;
  errors: readonly string[];
  onDismissError: (index: number) => void;
}

/**
 * Message composer: multiline auto-growing input, Enter to send /
 * Shift+Enter for a newline (IME-safe), attachment picker for the simulated
 * upload tray, and inline validation errors with dismiss controls.
 */
export function MessageComposer({
  partnerName,
  value,
  onValueChange,
  onSend,
  onFilesChosen,
  staged,
  onRemoveStaged,
  errors,
  onDismissError,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-grow the input up to its max height as content wraps.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [value]);

  const uploadsPending = staged.some((a) => a.progress < 100);
  const canSend =
    (value.trim().length > 0 || staged.length > 0) && !uploadsPending;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Don't send while an IME composition is in progress.
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (canSend) onSend();
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFilesChosen(event.target.files);
    }
    // Reset so choosing the same file again re-triggers change.
    event.target.value = "";
  };

  return (
    <div className={styles.composer}>
      <p className={styles.simulatedNote}>
        <AlertTriangleIcon size={13} />
        Simulated attachments — files are previewed locally and never uploaded
        or sent.
      </p>

      {errors.length > 0 ? (
        <div className={styles.composerErrors}>
          {errors.map((error, index) => (
            <div className={styles.composerError} role="alert" key={`${index}-${error}`}>
              <span>{error}</span>
              <IconButton
                label="Dismiss attachment error"
                onClick={() => onDismissError(index)}
              >
                <XIcon size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      ) : null}

      <AttachmentTray staged={staged} onRemove={onRemoveStaged} />

      <div className={styles.composerRow}>
        <IconButton
          label="Add photo or file attachment (simulated)"
          size="md"
          onClick={() => fileInputRef.current?.click()}
        >
          <PaperclipIcon size={19} />
        </IconButton>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={handleFileInput}
          accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.md,.zip,.doc,.docx"
        />
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          rows={1}
          placeholder={`Message ${partnerName.split(" ")[0]}…`}
          aria-label={`Message ${partnerName}`}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={styles.sendButton}
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
        >
          <SendIcon size={18} />
        </button>
      </div>
      <p className={styles.hint}>
        Enter sends · Shift+Enter adds a newline · attachments are simulated
      </p>
    </div>
  );
}
