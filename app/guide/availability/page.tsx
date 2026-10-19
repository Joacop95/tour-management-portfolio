import { GuideAvailabilityPage } from "@/components/guide-portal/guide-availability-page"
import { GuidePortalShell } from "@/components/layout/guide-portal-shell"

export default function GuideAvailabilityRoutePage() {
  return (
    <GuidePortalShell
      titleKey="guide_portal.availability.title"
      descriptionKey="guide_portal.availability.description"
    >
      <GuideAvailabilityPage />
    </GuidePortalShell>
  )
}
