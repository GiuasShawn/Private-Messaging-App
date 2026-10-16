"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./chat.module.css";
import type {
  Attachment,
  AsyncUiState,
  ChatMessage,
  PresenceState,
} from "@/lib/mock/types";
import { CANNED_REPLIES, MOCK_PARTNER, createInitialMessages } from "@/lib/mock/data";
import {
  CHAT_TIMINGS,
  validateAttachment,
} from "@/lib/ui/chat";
import { ChatHeader, type HistoryStateChoice } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";

type HistoryMode = AsyncUiState | "empty";

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(idCounter += 1)}`;

/**
 * The main chat screen — UI-only with mock data.
 *
 * Everything here is simulated locally: the initial history load, the
 * sending → sent → delivered → read ladder, the partner's typing indicator
 * and canned replies, and attachment "uploads" (timers only; files never
 * leave the device). No fetch/XHR is issued anywhere in this tree.
 */
export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    createInitialMessages(Date.now()),
  );
  const [historyMode, setHistoryMode] = useState<HistoryMode>("loading");
  const [draft, setDraft] = useState("");
  const [themTyping, setThemTyping] = useState(false);
  const [staged, setStaged] = useState<Attachment[]>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);

  const timersRef = useRef<number[]>([]);
  const createdUrlsRef = useRef<string[]>([]);
  const replyIndexRef = useRef(0);
  // Captured once on mount so date separators stay stable for the session.
  const [historyNow] = useState(() => Date.now());

  const schedule = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  // Initial mock history load, then settle into the ready state.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setHistoryMode((mode) => (mode === "loading" ? "ready" : mode)),
      CHAT_TIMINGS.initialHistoryLoadMs,
    );
    return () => window.clearTimeout(timer);
  }, []);

  // Clear every pending timer and local object URL on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    const urls = createdUrlsRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  // Simulated attachment upload: one interval while any staged item is
  // below 100%; purely local progress with no network activity.
  const uploadsPending = staged.some((a) => a.progress < 100);
  useEffect(() => {
    if (!uploadsPending) return;
    const interval = window.setInterval(() => {
      setStaged((prev) =>
        prev.map((attachment) =>
          attachment.progress < 100
            ? {
                ...attachment,
                progress: Math.min(
                  100,
                  attachment.progress + CHAT_TIMINGS.attachmentProgressStepPercent,
                ),
              }
            : attachment,
        ),
      );
    }, CHAT_TIMINGS.attachmentProgressTickMs);
    return () => window.clearInterval(interval);
  }, [uploadsPending]);

  const presence: PresenceState = themTyping ? "typing" : MOCK_PARTNER.presence;

  const handleSelectHistoryState = (choice: HistoryStateChoice) => {
    setHistoryMode(choice);
  };

  const handleRetryHistory = () => {
    setHistoryMode("loading");
    schedule(() => setHistoryMode("ready"), CHAT_TIMINGS.initialHistoryLoadMs);
  };

  const handleFilesChosen = (files: FileList) => {
    const accepted: Attachment[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const result = validateAttachment(file);
      if (!result.ok) {
        rejected.push(result.reason);
        continue;
      }
      const id = nextId("att");
      // Local object URL for image previews — never uploaded anywhere.
      const previewUrl =
        result.kind === "image" && typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(file)
          : undefined;
      if (previewUrl) createdUrlsRef.current.push(previewUrl);
      accepted.push({
        id,
        name: file.name,
        kind: result.kind,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        previewUrl,
        progress: 0,
        simulated: true,
      });
    }
    if (accepted.length > 0) setStaged((prev) => [...prev, ...accepted]);
    if (rejected.length > 0) setAttachmentErrors((prev) => [...prev, ...rejected]);
  };

  const handleRemoveStaged = (id: string) => {
    const target = staged.find((a) => a.id === id);
    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl);
      createdUrlsRef.current = createdUrlsRef.current.filter((u) => u !== target.previewUrl);
    }
    setStaged((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDismissError = (index: number) => {
    setAttachmentErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    const text = draft.trim();
    if ((text.length === 0 && staged.length === 0) || uploadsPending) return;

    const id = nextId("msg");
    const sentAt = Date.now();
    const sentAttachments = staged.map((attachment) => ({
      ...attachment,
      progress: 100,
    }));

    setMessages((prev) => [
      ...prev,
      { id, author: "me", text, sentAt, status: "sending", attachments: sentAttachments },
    ]);
    setDraft("");
    setStaged([]);
    setHistoryMode((mode) => (mode === "empty" ? "ready" : mode));

    const setStatus = (status: ChatMessage["status"]) =>
      setMessages((prev) =>
        prev.map((message) => (message.id === id ? { ...message, status } : message)),
      );

    schedule(() => setStatus("sent"), CHAT_TIMINGS.messageSentMs);
    schedule(() => setStatus("delivered"), CHAT_TIMINGS.messageDeliveredMs);
    schedule(() => setStatus("read"), CHAT_TIMINGS.messageReadMs);

    // Simulated partner: typing indicator, then a canned reply.
    schedule(() => setThemTyping(true), CHAT_TIMINGS.typingStartMs);
    schedule(
      () => {
        setThemTyping(false);
        const reply = CANNED_REPLIES[replyIndexRef.current % CANNED_REPLIES.length];
        replyIndexRef.current += 1;
        setMessages((prev) => [
          ...prev,
          {
            id: nextId("reply"),
            author: "them",
            text: reply,
            sentAt: Date.now(),
            status: "read",
            attachments: [],
          },
        ]);
      },
      CHAT_TIMINGS.replyArrivesMs,
    );
  };

  const listMode: AsyncUiState = historyMode === "empty" ? "ready" : historyMode;
  const listMessages = historyMode === "empty" ? [] : messages;

  return (
    <div className={styles.root}>
      <ChatHeader partner={MOCK_PARTNER} presence={presence} onSelectHistoryState={handleSelectHistoryState} />
      <MessageList
        messages={listMessages}
        partner={MOCK_PARTNER}
        state={listMode}
        themTyping={themTyping}
        now={historyNow}
        onRetry={handleRetryHistory}
      />
      <MessageComposer
        partnerName={MOCK_PARTNER.displayName}
        value={draft}
        onValueChange={setDraft}
        onSend={handleSend}
        onFilesChosen={handleFilesChosen}
        staged={staged}
        onRemoveStaged={handleRemoveStaged}
        errors={attachmentErrors}
        onDismissError={handleDismissError}
      />
    </div>
  );
}
