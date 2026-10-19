import { AppShell } from "@/components/shell/AppShell";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { ConversationList } from "@/components/chat/ConversationList";

export default function ChatPage() {
  return (
    <AppShell title="Messages" sidebarExtra={<ConversationList />}>
      <ChatScreen />
    </AppShell>
  );
}
