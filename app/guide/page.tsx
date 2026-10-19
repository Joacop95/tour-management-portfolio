import { GuideDashboardPage } from "@/components/guide-portal/guide-dashboard-page"
import { GuidePortalShell } from "@/components/layout/guide-portal-shell"

export default function GuideHomePage() {
  return (
    <GuidePortalShell
      titleKey="guide_portal.home.title"
      descriptionKey="guide_portal.home.description"
    >
      <GuideDashboardPage />
    </GuidePortalShell>
  )
}
