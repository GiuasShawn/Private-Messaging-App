import { AppShell } from "@/components/shell/AppShell";
import { SecurityScreen } from "@/components/security/SecurityScreen";

export default function SecurityPage() {
  return (
    <AppShell title="Security">
      <SecurityScreen />
    </AppShell>
  );
}
