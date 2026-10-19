import { GuideChangeRequestsPage } from "@/components/guide-portal/guide-change-requests-page"
import { GuidePortalShell } from "@/components/layout/guide-portal-shell"

export default function GuideChangeRequestsRoutePage() {
  return (
    <GuidePortalShell
      titleKey="guide_portal.change_requests.title"
      descriptionKey="guide_portal.change_requests.description"
    >
      <GuideChangeRequestsPage />
    </GuidePortalShell>
  )
}
