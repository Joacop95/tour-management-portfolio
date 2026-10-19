import { GuidesModule } from "@/components/guides/guides-module"
import { AdminShell } from "@/components/layout/admin-shell"
import { guides } from "@/lib/mock-data/guides"
import { circuits, tourGroups } from "@/lib/mock-data/groups"

export default function GuidesPage() {
  return (
    <AdminShell
      titleKey="guides.page.title"
      descriptionKey="guides.page.description"
    >
      <GuidesModule
        circuits={process.env.NODE_ENV === "production" ? [] : circuits}
        guides={process.env.NODE_ENV === "production" ? [] : guides}
        groups={process.env.NODE_ENV === "production" ? [] : tourGroups}
      />
    </AdminShell>
  )
}
