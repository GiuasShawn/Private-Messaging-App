import styles from "./chat.module.css";

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className={styles.dateRow}>
      <span className={styles.dateChip}>{label}</span>
    </div>
  );
}
