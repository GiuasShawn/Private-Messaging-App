import type { MessageStatus } from "@/lib/mock/types";
import styles from "./chat.module.css";
import { CheckCheckIcon, CheckIcon, ClockIcon } from "@/components/ui/icons";

const STATUS_LABEL: Record<MessageStatus, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
};

/**
 * Mock delivery/read receipt indicator for outgoing messages. The icons are
 * decorative; assistive technology reads the explicit status text.
 */
export function DeliveryStatus({ status }: { status: MessageStatus }) {
  return (
    <span
      className={status === "read" ? styles.statusRead : undefined}
      title={STATUS_LABEL[status]}
    >
      <span className="sr-only">{STATUS_LABEL[status]}</span>
      <span aria-hidden>
        {status === "sending" ? (
          <ClockIcon size={13} />
        ) : status === "sent" ? (
          <CheckIcon size={13} />
        ) : (
          <CheckCheckIcon size={14} />
        )}
      </span>
    </span>
  );
}
