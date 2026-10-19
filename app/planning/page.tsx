import { AdminShell } from "@/components/layout/admin-shell"
import { PlanningModule } from "@/components/planning/planning-module"
import { planningTimeline } from "@/lib/mock-data/planning"

export default function PlanningPage() {
  return (
    <AdminShell
      titleKey="planning.page.title"
      descriptionKey="planning.page.description"
    >
      <PlanningModule
        data={process.env.NODE_ENV === "production"
          ? { ...planningTimeline, circuits: [], guides: [], groups: [] }
          : planningTimeline}
      />
    </AdminShell>
  )
}
