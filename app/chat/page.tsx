import { AppShell } from "@/components/shell/AppShell";
import { ChatScreen } from "@/components/chat/ChatScreen";

export default function ChatPage() {
  return (
    <AppShell title="Chat">
      <ChatScreen />
    </AppShell>
  );
}
