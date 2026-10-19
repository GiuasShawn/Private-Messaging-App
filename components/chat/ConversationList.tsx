import styles from "./chat.module.css";
import { MOCK_PARTNER } from "@/lib/mock/data";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Conversation list shown in the sidebar on Messages, matching the design's
 * "Direct channel" list. The prototype has exactly one seeded conversation;
 * rows are non-interactive beyond the current channel.
 */
export function ConversationList() {
  return (
    <div className={styles.convList}>
      <p className={styles.convLabel}>Direct channel</p>
      <ul className={styles.convItems}>
        <li>
          <span
            className={`${styles.convItem} ${styles.convItemActive}`}
            aria-current="true"
          >
            <Avatar
              initials={MOCK_PARTNER.initials}
              size="sm"
              presence="online"
              label={MOCK_PARTNER.displayName}
            />
            <span className={styles.convText}>
              <span className={styles.convTop}>
                <span className={styles.convName}>{MOCK_PARTNER.displayName}</span>
                <span className={styles.convTime}>12:42</span>
              </span>
              <span className={styles.convPreview}>
                Simulated conversation · mock data
              </span>
            </span>
          </span>
        </li>
      </ul>
    </div>
  );
}
