import { AssignmentsModule } from "@/components/assignments/assignments-module"
import { AdminShell } from "@/components/layout/admin-shell"
import { guideAvailability } from "@/lib/mock-data/availability"
import { guides } from "@/lib/mock-data/guides"
import { circuits, tourGroups } from "@/lib/mock-data/groups"

export default function AssignmentsPage() {
  return (
    <AdminShell
      titleKey="assignments.page.title"
      descriptionKey="assignments.page.description"
    >
      <AssignmentsModule
        groups={process.env.NODE_ENV === "production" ? [] : tourGroups}
        guides={process.env.NODE_ENV === "production" ? [] : guides}
        availability={process.env.NODE_ENV === "production" ? [] : guideAvailability}
        circuits={process.env.NODE_ENV === "production" ? [] : circuits}
      />
    </AdminShell>
  )
}
