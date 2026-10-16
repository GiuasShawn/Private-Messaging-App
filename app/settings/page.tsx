import { AppShell } from "@/components/shell/AppShell";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <SettingsScreen />
    </AppShell>
  );
}
