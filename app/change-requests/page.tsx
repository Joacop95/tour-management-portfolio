import { ChangeRequestsModule } from "@/components/change-requests/change-requests-module"
import { AdminShell } from "@/components/layout/admin-shell"

export default function ChangeRequestsPage() {
  return (
    <AdminShell
      titleKey="change_requests.page.title"
      descriptionKey="change_requests.page.description"
    >
      <ChangeRequestsModule />
    </AdminShell>
  )
}
