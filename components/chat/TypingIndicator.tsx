import styles from "./chat.module.css";

/** Mock "Alex is typing…" pill (decorative dots + screen-reader text). */
export function TypingIndicator({ name }: { name: string }) {
  return (
    <div className={styles.typingRow}>
      <div className={styles.typingBubble} role="status">
        <span className="sr-only">{name} is typing…</span>
        <span className={styles.typingDot} aria-hidden />
        <span className={styles.typingDot} aria-hidden />
        <span className={styles.typingDot} aria-hidden />
      </div>
    </div>
  );
}
