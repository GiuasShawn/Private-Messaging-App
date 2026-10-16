import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/Tooltip";
import { MessageIcon } from "@/components/ui/icons";

export default function ChatPage() {
  return (
    <AppShell title="Chat">
      <EmptyState
        icon={<MessageIcon size={22} />}
        title="Chat screen"
        description="The conversation UI lands in the next checkpoint of Phase 1."
      />
    </AppShell>
  );
}
