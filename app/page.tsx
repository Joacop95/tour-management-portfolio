import { DashboardModule } from "@/components/dashboard/dashboard-module"
import { AdminShell } from "@/components/layout/admin-shell"

export default function Home() {
  return (
    <AdminShell>
      <DashboardModule />
    </AdminShell>
  )
}
