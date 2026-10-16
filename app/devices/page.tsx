import { AppShell } from "@/components/shell/AppShell";
import { DevicesScreen } from "@/components/devices/DevicesScreen";

export default function DevicesPage() {
  return (
    <AppShell title="Devices">
      <DevicesScreen />
    </AppShell>
  );
}
