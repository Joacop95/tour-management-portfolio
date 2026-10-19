import { GuideGroupsPage } from "@/components/guide-portal/guide-groups-page"
import { GuidePortalShell } from "@/components/layout/guide-portal-shell"

export default function GuideGroupsRoutePage() {
  return (
    <GuidePortalShell
      titleKey="guide_portal.groups.title"
      descriptionKey="guide_portal.groups.description"
    >
      <GuideGroupsPage />
    </GuidePortalShell>
  )
}
