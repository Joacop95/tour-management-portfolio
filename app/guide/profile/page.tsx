import { GuideProfilePage } from "@/components/guide-portal/guide-profile-page"
import { GuidePortalShell } from "@/components/layout/guide-portal-shell"

export default function GuideProfileRoutePage() {
  return (
    <GuidePortalShell
      titleKey="guide_portal.profile.title"
      descriptionKey="guide_portal.profile.description"
    >
      <GuideProfilePage />
    </GuidePortalShell>
  )
}
