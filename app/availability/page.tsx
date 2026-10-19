import { AvailabilityModule } from "@/components/availability/availability-module"
import { AdminShell } from "@/components/layout/admin-shell"
import { guideAvailability } from "@/lib/mock-data/availability"
import { guides } from "@/lib/mock-data/guides"
import { circuits, tourGroups } from "@/lib/mock-data/groups"

export default function AvailabilityPage() {
  return (
    <AdminShell
      titleKey="availability.page.title"
      descriptionKey="availability.page.description"
    >
      <AvailabilityModule
        availability={process.env.NODE_ENV === "production" ? [] : guideAvailability}
        guides={process.env.NODE_ENV === "production" ? [] : guides}
        circuits={process.env.NODE_ENV === "production" ? [] : circuits}
        groups={process.env.NODE_ENV === "production" ? [] : tourGroups}
      />
    </AdminShell>
  )
}
