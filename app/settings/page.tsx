import { AdminShell } from "@/components/layout/admin-shell"
import { SettingsModule } from "@/components/settings/settings-module"
export default function SettingsPage() {
  return (
    <AdminShell titleKey="settings.page.title" descriptionKey="settings.page.description">
      <SettingsModule />
    </AdminShell>
  )
}
