"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useState } from "react"
import { Check, Repeat } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { GuidePortalIdentityStatus } from "@/lib/auth/guide-portal-auth"
import { confirmOwnGuideAssignment } from "@/lib/supabase/mutations/guide-portal-assignments"
import type { TourGroup } from "@/lib/types/domain"

export function GuideAssignmentActions({
  group,
  guidePortalSource,
  guidePortalAuthStatus,
  onConfirmed,
  onRequestChange,
}: {
  group: TourGroup
  guidePortalSource: "preview" | "auth"
  guidePortalAuthStatus: GuidePortalIdentityStatus
  onConfirmed: () => void
  onRequestChange: () => void
}) {
  const { t } = useI18n()
  const [isConfirming, setIsConfirming] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)
  const canConfirm =
    guidePortalSource === "auth" &&
    guidePortalAuthStatus === "ready" &&
    group.confirmationStatus === "pending-confirmation" &&
    Boolean(group.currentAssignmentId)

  async function handleConfirm() {
    if (!canConfirm || !group.currentAssignmentId || isConfirming) {
      return
    }

    setIsConfirming(true)
    setFeedback("")
    setFeedbackSuccess(false)

    const result = await confirmOwnGuideAssignment(group.currentAssignmentId)

    setIsConfirming(false)

    if (!result.success) {
      setFeedback(
        result.code === "assignment_not_eligible"
          ? t("guide_portal.assignment.no_longer_available")
          : result.message
      )
      return
    }

    setFeedback(t("guide_portal.assignment.confirmed"))
    setFeedbackSuccess(true)
    onConfirmed()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!canConfirm || isConfirming}
          title={
            canConfirm
              ? t("guide_portal.assignment.confirm_title")
              : guidePortalSource === "preview"
                ? t("guide_portal.assignment.preview_read_only")
                : t("guide_portal.assignment.unavailable_title")
          }
          onClick={handleConfirm}
        >
          <Check />
          {isConfirming ? t("guide_portal.assignment.confirming") : t("guide_portal.assignment.confirm_action")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            guidePortalSource !== "auth" || guidePortalAuthStatus !== "ready"
          }
          title={
            guidePortalSource === "preview"
              ? t("guide_portal.assignment.preview_read_only")
              : t("guide_portal.assignment.request_change_title")
          }
          onClick={onRequestChange}
        >
          <Repeat />
          <T i18nKey="guide_portal.guide_assignment_actions.request_a_change" />
        </Button>
      </div>
      {feedback ? (
        <p
          className={`text-sm ${
            feedbackSuccess
              ? "text-emerald-700"
              : "text-destructive"
          }`}
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  )
}
