import { GroupsModule } from "@/components/groups/groups-module"
import { AdminShell } from "@/components/layout/admin-shell"
import { guideAvailability } from "@/lib/mock-data/availability"
import { circuits, guides, tourGroups } from "@/lib/mock-data/groups"

export default function GroupsPage() {
  return (
    <AdminShell
      titleKey="groups.page.title"
      descriptionKey="groups.page.description"
    >
      <GroupsModule
        circuits={process.env.NODE_ENV === "production" ? [] : circuits}
        guides={process.env.NODE_ENV === "production" ? [] : guides}
        groups={process.env.NODE_ENV === "production" ? [] : tourGroups}
        availability={process.env.NODE_ENV === "production" ? [] : guideAvailability}
      />
    </AdminShell>
  )
}
